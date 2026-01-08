#!/usr/bin/env python3
"""
Script para migrar datos de SQLite local a PostgreSQL en Render
Ejecutar localmente - se conecta remotamente a PostgreSQL
"""
import sqlite3
import psycopg2
import os
from datetime import datetime

# Configuración
SQLITE_PATH = "/home/mauro/dev/chorizaurio/data/ventas.db"
# URL de PostgreSQL de Render (External URL)
POSTGRES_URL = "postgresql://chorizaurio_db_user:W3ICkw87ke2mFnMt2XnooF0eUu5GNSpy@dpg-d5fjs09r0fns73bsku10-a.oregon-postgres.render.com/chorizaurio_db?sslmode=require"

def get_sqlite_conn():
    return sqlite3.connect(SQLITE_PATH)

def get_postgres_conn():
    return psycopg2.connect(POSTGRES_URL)

def get_columns(sqlite_cur, table):
    sqlite_cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in sqlite_cur.fetchall()]

def migrate_table(table, pg_columns_override=None):
    """Migrar una tabla de SQLite a PostgreSQL"""
    print(f"\n=== Migrando {table} ===")
    
    sqlite_conn = get_sqlite_conn()
    sqlite_cur = sqlite_conn.cursor()
    
    # Obtener columnas de SQLite
    sqlite_cols = get_columns(sqlite_cur, table)
    print(f"  SQLite columns: {sqlite_cols}")
    
    # Obtener datos
    sqlite_cur.execute(f"SELECT * FROM {table}")
    rows = sqlite_cur.fetchall()
    print(f"  Rows to migrate: {len(rows)}")
    
    if len(rows) == 0:
        print(f"  Skipping {table} - no data")
        sqlite_conn.close()
        return 0
    
    # Conectar a PostgreSQL
    pg_conn = get_postgres_conn()
    pg_cur = pg_conn.cursor()
    
    # Obtener columnas de PostgreSQL
    pg_cur.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = %s AND table_schema = 'public'
        ORDER BY ordinal_position
    """, (table,))
    pg_cols = [r[0] for r in pg_cur.fetchall()]
    print(f"  PostgreSQL columns: {pg_cols}")
    
    # Mapear columnas (SQLite -> PostgreSQL)
    # Manejar diferencias de nombres
    col_mapping = {}
    for sc in sqlite_cols:
        if sc in pg_cols:
            col_mapping[sc] = sc
        elif sc == 'nombre_usuario' and 'username' in pg_cols:
            col_mapping[sc] = 'username'
        elif sc == 'username' and 'nombre_usuario' in pg_cols:
            col_mapping[sc] = 'nombre_usuario'
        elif sc == 'activo' and sc in pg_cols:
            col_mapping[sc] = sc
    
    # Columnas comunes
    common_cols = list(col_mapping.keys())
    target_cols = [col_mapping[c] for c in common_cols]
    
    if not common_cols:
        print(f"  ERROR: No common columns found!")
        pg_conn.close()
        sqlite_conn.close()
        return 0
    
    print(f"  Mapping: {col_mapping}")
    
    # Preparar INSERT
    placeholders = ', '.join(['%s'] * len(target_cols))
    insert_sql = f"INSERT INTO {table} ({', '.join(target_cols)}) VALUES ({placeholders})"
    
    # Índices de columnas en SQLite
    col_indices = [sqlite_cols.index(c) for c in common_cols]
    
    migrated = 0
    errors = 0
    batch = []
    batch_size = 100
    
    for row in rows:
        try:
            # Extraer valores en el orden correcto
            values = []
            for i, idx in enumerate(col_indices):
                v = row[idx]
                col_name = target_cols[i]
                
                # Convertir booleanos (SQLite usa 0/1, PostgreSQL usa True/False)
                if col_name in ('activo', 'activa', 'pdf_generado'):
                    v = bool(v) if v is not None else False
                
                values.append(v)
            
            batch.append(values)
            
            if len(batch) >= batch_size:
                # Execute batch
                from psycopg2.extras import execute_values
                execute_values(pg_cur, f"INSERT INTO {table} ({', '.join(target_cols)}) VALUES %s", batch)
                migrated += len(batch)
                batch = []
                
        except Exception as e:
            pg_conn.rollback()
            errors += 1
            if errors <= 3:
                print(f"  Error row: {e}")
    
    # Insert remaining
    if batch:
        try:
            from psycopg2.extras import execute_values
            execute_values(pg_cur, f"INSERT INTO {table} ({', '.join(target_cols)}) VALUES %s", batch)
            migrated += len(batch)
        except Exception as e:
            print(f"  Final batch error: {e}")
    
    pg_conn.commit()
    
    # Actualizar secuencia de ID
    try:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table}")
        pg_conn.commit()
    except:
        pass
    
    pg_conn.close()
    sqlite_conn.close()
    
    print(f"  Migrated: {migrated}, Errors: {errors}")
    return migrated


def clear_postgres_data():
    """Limpiar datos existentes en PostgreSQL (mantener schema)"""
    print("\n=== Limpiando datos en PostgreSQL ===")
    
    pg_conn = get_postgres_conn()
    pg_cur = pg_conn.cursor()
    
    # Orden de eliminación (respetando foreign keys)
    tables_to_clear = [
        'detalles_template', 'pedidos_template',
        'precios_lista', 'oferta_productos', 'ofertas',
        'productos_tags', 'tags',
        'historial_pedidos', 'audit_log', 'revoked_tokens',
        'detalles_pedido', 'pedidos',
        'productos', 'categorias', 'listas_precios',
        'clientes', 'usuarios'
    ]
    
    for table in tables_to_clear:
        try:
            pg_cur.execute(f"DELETE FROM {table}")
            print(f"  Cleared {table}")
        except Exception as e:
            print(f"  Error clearing {table}: {e}")
    
    pg_conn.commit()
    pg_conn.close()


def main():
    print("=" * 60)
    print("MIGRACIÓN SQLite -> PostgreSQL (Render)")
    print("=" * 60)
    print(f"SQLite: {SQLITE_PATH}")
    print(f"PostgreSQL: dpg-...oregon-postgres.render.com")
    print(f"Timestamp: {datetime.now()}")
    
    # Limpiar datos existentes
    clear_postgres_data()
    
    # Orden de migración (respetando dependencias)
    tables = [
        'usuarios',
        'categorias',
        'listas_precios',
        'clientes',
        'productos',
        'precios_lista',
        'tags',
        'productos_tags',
        'pedidos',
        'detalles_pedido',
        'ofertas',
        'oferta_productos',
        'historial_pedidos',
        'pedidos_template',
        'detalles_template',
        'audit_log',
    ]
    
    total = 0
    for table in tables:
        try:
            count = migrate_table(table)
            total += count
        except Exception as e:
            print(f"  FAILED: {e}")
    
    print("\n" + "=" * 60)
    print(f"MIGRACIÓN COMPLETADA - Total rows: {total}")
    print("=" * 60)


if __name__ == "__main__":
    main()
