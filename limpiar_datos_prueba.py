#!/usr/bin/env python3
"""
Script para eliminar todos los datos de prueba de la base de datos.
Busca registros que contengan: TEST, PRUEBA, E2E, test, prueba, e2e
"""
import sqlite3
import sys
from datetime import datetime

def limpiar_datos_prueba(db_path='data/ventas.db', dry_run=True):
    """
    Elimina todos los datos de prueba de la base de datos.
    
    Args:
        db_path: Ruta a la base de datos SQLite
        dry_run: Si es True, solo muestra qué se eliminaría sin hacer cambios
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    test_patterns = ['TEST', 'PRUEBA', 'E2E', 'test', 'prueba', 'e2e', 'Test', 'Prueba']
    
    # Orden de eliminación para respetar foreign keys
    tables_order = [
        'detalles_pedido',      # Detalles de pedidos primero
        'detalles_template',    # Detalles de templates
        'historial_pedidos',    # Historial
        'pedidos',              # Luego pedidos
        'pedidos_template',     # Templates
        'oferta_productos',     # Productos en ofertas
        'ofertas',              # Ofertas
        'productos_tags',       # Tags de productos
        'precios_lista',        # Precios por lista
        'productos',            # Productos
        'clientes',             # Clientes
        'usuarios',             # Usuarios
        'categorias',           # Categorías
        'repartidores',         # Repartidores
        'audit_log',            # Logs de auditoría
    ]
    
    total_deleted = 0
    deletions = {}
    
    print(f"\n{'='*60}")
    print(f"{'LIMPIEZA DE DATOS DE PRUEBA':^60}")
    print(f"{'='*60}")
    print(f"Modo: {'DRY RUN (simulación)' if dry_run else 'REAL (eliminará datos)'}")
    print(f"Base de datos: {db_path}")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    for table_name in tables_order:
        # Verificar si la tabla existe
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        if not cursor.fetchone():
            continue
        
        # Obtener columnas de texto
        cursor.execute(f'PRAGMA table_info({table_name})')
        columns = cursor.fetchall()
        text_columns = [col[1] for col in columns if col[2] in ('TEXT', 'VARCHAR', 'CHAR')]
        
        if not text_columns:
            continue
        
        # Construir condiciones de búsqueda
        conditions = []
        for col in text_columns:
            for pattern in test_patterns:
                conditions.append(f"{col} LIKE '%{pattern}%'")
        
        where_clause = ' OR '.join(conditions)
        
        # Contar registros a eliminar
        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {where_clause}")
        count = cursor.fetchone()[0]
        
        if count > 0:
            # Mostrar algunos ejemplos
            cursor.execute(f"SELECT * FROM {table_name} WHERE {where_clause} LIMIT 5")
            samples = cursor.fetchall()
            
            print(f"📋 Tabla: {table_name}")
            print(f"   ➤ Registros a eliminar: {count}")
            print(f"   ➤ Ejemplos:")
            for i, sample in enumerate(samples[:3], 1):
                # Mostrar solo primeros campos para no saturar
                preview = str(sample[:5])[:100] + '...' if len(str(sample[:5])) > 100 else str(sample[:5])
                print(f"      {i}. {preview}")
            
            if not dry_run:
                # Eliminar registros
                cursor.execute(f"DELETE FROM {table_name} WHERE {where_clause}")
                deleted = cursor.rowcount
                print(f"   ✅ Eliminados: {deleted}")
                deletions[table_name] = deleted
                total_deleted += deleted
            else:
                print(f"   ⚠️  Se eliminarían en modo real")
                deletions[table_name] = count
                total_deleted += count
            
            print()
    
    # Resumen
    print(f"{'='*60}")
    print(f"{'RESUMEN':^60}")
    print(f"{'='*60}")
    for table, count in deletions.items():
        print(f"  {table:.<40} {count:>5} registros")
    print(f"{'='*60}")
    print(f"  {'TOTAL':.<40} {total_deleted:>5} registros")
    print(f"{'='*60}\n")
    
    if not dry_run:
        conn.commit()
        print("✅ Cambios guardados en la base de datos")
        
        # Ejecutar VACUUM para recuperar espacio
        print("🔧 Optimizando base de datos (VACUUM)...")
        conn.execute('VACUUM')
        print("✅ Base de datos optimizada")
    else:
        print("⚠️  Modo DRY RUN: No se realizaron cambios")
        print("💡 Para eliminar realmente, ejecuta: python limpiar_datos_prueba.py --real")
    
    conn.close()
    
    return deletions

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Eliminar datos de prueba de la base de datos')
    parser.add_argument('--real', action='store_true', help='Realizar eliminación real (sin este flag solo simula)')
    parser.add_argument('--db', default='data/ventas.db', help='Ruta a la base de datos')
    
    args = parser.parse_args()
    
    if args.real:
        confirm = input("\n⚠️  ¿Estás seguro de que quieres eliminar los datos de prueba? (escribe 'SI' para confirmar): ")
        if confirm != 'SI':
            print("❌ Cancelado")
            sys.exit(0)
    
    limpiar_datos_prueba(db_path=args.db, dry_run=not args.real)
