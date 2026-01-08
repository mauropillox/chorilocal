#!/usr/bin/env python3
"""
Migración Automática de SQLite a PostgreSQL para Producción
Usa las configuraciones actuales del sistema y migra todos los datos
"""

import os
import sys
import sqlite3
import psycopg2
import psycopg2.extras
from datetime import datetime
import urllib.parse

# Importar configuración del sistema
sys.path.append('/app' if os.path.exists('/app/db.py') else '.')
import db

def log(message, level="INFO"):
    """Log con timestamp y nivel"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {level}: {message}")

def get_database_urls():
    """Obtener URLs de las bases de datos"""
    # SQLite - buscar en las ubicaciones típicas
    sqlite_paths = [
        os.getenv("SQLITE_BACKUP_PATH", "./data/ventas.db"),
        "/data/ventas.db",
        "./data/ventas.db", 
        "./ventas.db",
        "/tmp/ventas.db"
    ]
    
    sqlite_db = None
    for path in sqlite_paths:
        if os.path.exists(path):
            sqlite_db = path
            log(f"Found SQLite database: {path}")
            break
    
    if not sqlite_db:
        log("ERROR: SQLite database not found in any expected location", "ERROR")
        log("Searched paths: " + ", ".join(sqlite_paths), "ERROR")
        return None, None
    
    # PostgreSQL - usar DATABASE_URL del entorno
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url:
        log("ERROR: DATABASE_URL not found", "ERROR")
        return None, None
        
    log(f"PostgreSQL URL configured: {postgres_url[:50]}...")
    return sqlite_db, postgres_url

def parse_postgres_url(database_url):
    """Parsear DATABASE_URL a configuración de psycopg2"""
    parsed = urllib.parse.urlparse(database_url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'database': parsed.path[1:],  # Remove leading slash
        'user': parsed.username,
        'password': parsed.password
    }

def test_connections(sqlite_path, pg_config):
    """Probar conexiones a ambas bases de datos"""
    log("Testing database connections...")
    
    # Test SQLite
    try:
        sqlite_conn = sqlite3.connect(sqlite_path)
        cursor = sqlite_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]
        log(f"✅ SQLite connected: {table_count} tables found")
        sqlite_conn.close()
    except Exception as e:
        log(f"❌ SQLite connection failed: {e}", "ERROR")
        return False
    
    # Test PostgreSQL
    try:
        pg_conn = psycopg2.connect(**pg_config)
        cursor = pg_conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        log(f"✅ PostgreSQL connected: {version}")
        pg_conn.close()
    except Exception as e:
        log(f"❌ PostgreSQL connection failed: {e}", "ERROR")
        return False
    
    return True

def ensure_postgres_schema(pg_config):
    """Crear schema en PostgreSQL usando el módulo db existente"""
    log("Creating PostgreSQL schema...")
    
    # Temporalmente configurar PostgreSQL
    original_use_postgres = os.getenv("USE_POSTGRES")
    original_db_url = os.getenv("DATABASE_URL")
    
    try:
        os.environ["USE_POSTGRES"] = "true"
        # DATABASE_URL ya está configurado
        
        # Importar y crear schema
        import importlib
        importlib.reload(db)  # Recargar con nueva configuración
        
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Crear todas las tablas usando el schema existente
            db.ensure_schema()
            log("✅ PostgreSQL schema created successfully")
            
            # Verificar tablas creadas
            cursor.execute("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            tables = [row[0] for row in cursor.fetchall()]
            log(f"Created tables: {', '.join(tables)}")
            
    except Exception as e:
        log(f"❌ Schema creation failed: {e}", "ERROR")
        return False
    finally:
        # Restaurar configuración original
        if original_use_postgres:
            os.environ["USE_POSTGRES"] = original_use_postgres
        if original_db_url:
            os.environ["DATABASE_URL"] = original_db_url
    
    return True

def migrate_table_data(sqlite_path, pg_config, table_name):
    """Migrar datos de una tabla específica"""
    log(f"Migrating table: {table_name}")
    
    # Conectar a SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # Conectar a PostgreSQL
    pg_conn = psycopg2.connect(**pg_config)
    pg_cursor = pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Obtener datos de SQLite
        sqlite_cursor.execute(f"SELECT * FROM {table_name}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            log(f"  ℹ️  Table {table_name} is empty")
            return True
        
        # Obtener estructura de columnas
        column_names = [description[0] for description in sqlite_cursor.description]
        
        # Limpiar tabla en PostgreSQL (por si tiene datos)
        pg_cursor.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
        
        # Preparar consulta de inserción
        placeholders = ', '.join(['%s'] * len(column_names))
        columns_str = ', '.join(column_names)
        insert_query = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
        
        # Insertar datos
        for row in rows:
            try:
                values = [row[col] for col in column_names]
                pg_cursor.execute(insert_query, values)
            except Exception as e:
                log(f"  ⚠️  Error inserting row in {table_name}: {e}", "WARNING")
                continue
        
        pg_conn.commit()
        log(f"  ✅ Migrated {len(rows)} records to {table_name}")
        return True
        
    except Exception as e:
        log(f"  ❌ Failed to migrate {table_name}: {e}", "ERROR")
        pg_conn.rollback()
        return False
    finally:
        sqlite_conn.close()
        pg_conn.close()

def migrate_all_data(sqlite_path, pg_config):
    """Migrar todos los datos de SQLite a PostgreSQL"""
    log("Starting full data migration...")
    
    # Obtener lista de tablas de SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [row[0] for row in cursor.fetchall()]
    sqlite_conn.close()
    
    log(f"Found tables to migrate: {', '.join(tables)}")
    
    # Orden específico para evitar problemas de foreign keys
    table_order = [
        'usuarios', 'categorias', 'clientes', 'productos', 
        'ofertas', 'pedidos', 'detalles_pedido', 'historial_pedidos',
        'revoked_tokens', 'audit_log'
    ]
    
    # Migrar en orden específico primero
    migrated = []
    failed = []
    
    for table in table_order:
        if table in tables:
            if migrate_table_data(sqlite_path, pg_config, table):
                migrated.append(table)
            else:
                failed.append(table)
            tables.remove(table)
    
    # Migrar tablas restantes
    for table in tables:
        if migrate_table_data(sqlite_path, pg_config, table):
            migrated.append(table)
        else:
            failed.append(table)
    
    log(f"Migration completed: {len(migrated)} successful, {len(failed)} failed")
    if failed:
        log(f"Failed tables: {', '.join(failed)}", "WARNING")
    
    return len(failed) == 0

def verify_migration(sqlite_path, pg_config):
    """Verificar que la migración fue exitosa"""
    log("Verifying migration...")
    
    sqlite_conn = sqlite3.connect(sqlite_path)
    pg_conn = psycopg2.connect(**pg_config)
    
    try:
        # Comparar conteo de registros por tabla
        sqlite_cursor = sqlite_conn.cursor()
        pg_cursor = pg_conn.cursor()
        
        # Obtener tablas
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [row[0] for row in sqlite_cursor.fetchall()]
        
        all_good = True
        for table in tables:
            try:
                sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                sqlite_count = sqlite_cursor.fetchone()[0]
                
                pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                pg_count = pg_cursor.fetchone()[0]
                
                if sqlite_count == pg_count:
                    log(f"  ✅ {table}: {sqlite_count} records (matches)")
                else:
                    log(f"  ⚠️  {table}: SQLite={sqlite_count}, PostgreSQL={pg_count}", "WARNING")
                    all_good = False
            except Exception as e:
                log(f"  ❌ Error verifying {table}: {e}", "ERROR")
                all_good = False
        
        return all_good
        
    finally:
        sqlite_conn.close()
        pg_conn.close()

def main():
    """Función principal de migración"""
    log("🚀 Starting automatic SQLite to PostgreSQL migration")
    log("=" * 60)
    
    # Obtener URLs de bases de datos
    sqlite_path, postgres_url = get_database_urls()
    if not sqlite_path or not postgres_url:
        log("❌ Migration failed: Database configuration invalid", "ERROR")
        return False
    
    # Parsear configuración de PostgreSQL
    pg_config = parse_postgres_url(postgres_url)
    
    # Probar conexiones
    if not test_connections(sqlite_path, pg_config):
        log("❌ Migration failed: Connection test failed", "ERROR")
        return False
    
    # Crear schema en PostgreSQL
    if not ensure_postgres_schema(pg_config):
        log("❌ Migration failed: Schema creation failed", "ERROR")
        return False
    
    # Migrar datos
    if not migrate_all_data(sqlite_path, pg_config):
        log("⚠️  Migration completed with some errors", "WARNING")
    
    # Verificar migración
    if verify_migration(sqlite_path, pg_config):
        log("✅ Migration verification successful")
    else:
        log("⚠️  Migration verification found discrepancies", "WARNING")
    
    log("=" * 60)
    log("🎉 Migration process completed!")
    log("Next steps:")
    log("1. Remove DB_PATH from Render environment variables")
    log("2. Verify application is working with PostgreSQL")
    log("3. Test all functionality")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)