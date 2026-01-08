"""
Migración: Simplificar estados de pedidos
- tomado → pendiente  
- preparando → preparando (sin cambio)
- listo → preparando (o entregado si ya estaba listo)
- entregado → entregado (sin cambio)
- cancelado → cancelado (sin cambio)
"""

import sqlite3
import os
from datetime import datetime

# Path to database - buscar en múltiples ubicaciones
def find_database():
    possible_paths = [
        "/data/ventas.db",
        "../data/ventas.db", 
        "./data/ventas.db",
        "data/ventas.db",
        "ventas.db",
        "backend/ventas.db"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    return None

DB_PATH = find_database() or os.getenv("DB_PATH", "/data/ventas.db")

def migrate_estados():
    print(f"🔄 Migrando estados de pedidos en {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Base de datos no encontrada: {DB_PATH}")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Contar pedidos por estado antes
        cursor.execute("SELECT estado, COUNT(*) FROM pedidos GROUP BY estado")
        antes = dict(cursor.fetchall())
        print(f"📊 Estados ANTES: {antes}")
        
        # Migrar estados
        migrations = {
            'tomado': 'pendiente',
            'listo': 'preparando',  # listo pasa a preparando
            # preparando, entregado, cancelado quedan igual
        }
        
        for old_estado, new_estado in migrations.items():
            cursor.execute(
                "UPDATE pedidos SET estado = ? WHERE estado = ?", 
                (new_estado, old_estado)
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                print(f"✅ {old_estado} → {new_estado}: {rows_updated} pedidos")
        
        # Actualizar NULL estados a 'pendiente'
        cursor.execute("UPDATE pedidos SET estado = 'pendiente' WHERE estado IS NULL")
        null_updated = cursor.rowcount
        if null_updated > 0:
            print(f"✅ NULL → pendiente: {null_updated} pedidos")
        
        # Contar después
        cursor.execute("SELECT estado, COUNT(*) FROM pedidos GROUP BY estado")
        despues = dict(cursor.fetchall())
        print(f"📊 Estados DESPUÉS: {despues}")
        
        # Commit
        conn.commit()
        print("✅ Migración completada exitosamente")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en migración: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_estados()