#!/usr/bin/env python3
"""
Script de migración de SQLite a PostgreSQL
Transfiere el schema completo y los datos existentes
"""

import sqlite3
import psycopg2
import os
import sys
from datetime import datetime

# Configuración de bases de datos
SQLITE_DB = os.getenv("SQLITE_DB_PATH", "./data/ventas.db")
PG_CONFIG = {
    'host': os.getenv('PG_HOST', 'localhost'),
    'port': os.getenv('PG_PORT', '5432'),
    'database': os.getenv('PG_DATABASE', 'chorizaurio_dev'),
    'user': os.getenv('PG_USER', 'chorizaurio'),
    'password': os.getenv('PG_PASSWORD')
}

def log(message):
    """Log con timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def get_sqlite_tables():
    """Obtener lista de tablas de SQLite"""
    conn = sqlite3.connect(SQLITE_DB)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    return tables

def get_sqlite_schema(table_name):
    """Obtener schema de una tabla SQLite"""
    conn = sqlite3.connect(SQLITE_DB)
    cursor = conn.cursor()
    
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    
    conn.close()
    return columns

def sqlite_to_postgres_type(sqlite_type, table_name=None, column_name=None):
    """Convertir tipos de SQLite a PostgreSQL"""
    
    # Identificar campos booleanos por contexto
    boolean_fields = {
        'pedidos': ['pdf_generado', 'pdf_descargado'],
        'productos': ['activo'],
        'usuarios': ['activo']
    }
    
    # Si es un campo que sabemos que debería ser boolean
    if table_name and column_name:
        if table_name in boolean_fields and column_name in boolean_fields[table_name]:
            return 'BOOLEAN'
    
    type_mapping = {
        'INTEGER': 'INTEGER',
        'TEXT': 'TEXT',
        'REAL': 'REAL',
        'BLOB': 'BYTEA',
        'NUMERIC': 'NUMERIC',
        'VARCHAR': 'VARCHAR',
        'BOOLEAN': 'BOOLEAN',
        'DATETIME': 'TIMESTAMP',
        'DATE': 'DATE',
        'TIME': 'TIME'
    }
    
    # Manejar tipos con parámetros como VARCHAR(255)
    sqlite_type_upper = sqlite_type.upper()
    for sqlite_t, postgres_t in type_mapping.items():
        if sqlite_type_upper.startswith(sqlite_t):
            return sqlite_type_upper.replace(sqlite_t, postgres_t)
    
    # Default a TEXT si no se reconoce
    return 'TEXT'

def create_postgres_table(pg_cursor, table_name, sqlite_columns):
    """Crear tabla en PostgreSQL basada en schema SQLite"""
    log(f"Creando tabla {table_name} en PostgreSQL...")
    
    columns_sql = []
    primary_keys = []
    
    for col in sqlite_columns:
        cid, name, type_name, notnull, default_value, pk = col
        
        # Convertir tipo con contexto
        pg_type = sqlite_to_postgres_type(type_name, table_name, name)
        
        # Construir definición de columna
        col_def = f"{name} {pg_type}"
        
        # Recopilar primary keys
        if pk:
            primary_keys.append(name)
        
        # NOT NULL
        if notnull and not pk:
            col_def += " NOT NULL"
        
        # Default value
        if default_value is not None:
            if pg_type in ['TEXT', 'VARCHAR']:
                # Escapar comillas simples en strings
                escaped_value = str(default_value).replace("'", "''")
                col_def += f" DEFAULT '{escaped_value}'"
            elif pg_type == 'BOOLEAN':
                # Convertir valores numéricos a boolean
                bool_value = 'TRUE' if str(default_value) in ['1', 'true', 'True', 'TRUE'] else 'FALSE'
                col_def += f" DEFAULT {bool_value}"
            else:
                col_def += f" DEFAULT {default_value}"
        
        columns_sql.append(col_def)
    
    # Agregar constraint de PRIMARY KEY
    if primary_keys:
        if len(primary_keys) == 1:
            # Single primary key - usar SERIAL si es INTEGER
            pk_col_info = next(col for col in sqlite_columns if col[0] == (min([col[0] for col in sqlite_columns if col[5]])))
            if pk_col_info[2].upper() == 'INTEGER':
                # Reemplazar con SERIAL
                pk_name = pk_col_info[1]
                for i, col_def in enumerate(columns_sql):
                    if col_def.startswith(pk_name):
                        columns_sql[i] = f"{pk_name} SERIAL PRIMARY KEY"
                        break
            else:
                columns_sql.append(f"PRIMARY KEY ({primary_keys[0]})")
        else:
            # Composite primary key
            pk_cols = ', '.join(primary_keys)
            columns_sql.append(f"PRIMARY KEY ({pk_cols})")
    
    # Crear tabla
    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns_sql)})"
    
    try:
        pg_cursor.execute(create_sql)
        log(f"✅ Tabla {table_name} creada exitosamente")
    except Exception as e:
        log(f"❌ Error creando tabla {table_name}: {e}")
        raise

def convert_sqlite_value_to_postgres(value, column_name, table_name):
    """Convertir valores de SQLite a formato PostgreSQL"""
    if value is None:
        return None
    
    # Campos booleanos conocidos
    boolean_fields = {
        'pedidos': ['pdf_generado', 'pdf_descargado'],
        'productos': ['activo'],
        'usuarios': ['activo']
    }
    
    if table_name in boolean_fields and column_name in boolean_fields[table_name]:
        # Convertir 0/1 a False/True
        return bool(value)
    
    return value

def migrate_table_data(table_name):
    """Migrar datos de una tabla de SQLite a PostgreSQL"""
    log(f"Migrando datos de tabla {table_name}...")
    
    # Conectar a SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # Conectar a PostgreSQL
    pg_conn = psycopg2.connect(**PG_CONFIG)
    pg_cursor = pg_conn.cursor()
    
    try:
        # Limpiar tabla de PostgreSQL primero
        pg_cursor.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
        pg_conn.commit()
        
        # Obtener todos los datos de SQLite
        sqlite_cursor.execute(f"SELECT * FROM {table_name}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            log(f"⚠️  Tabla {table_name} está vacía")
            return 0
        
        # Obtener nombres de columnas
        column_names = [description[0] for description in sqlite_cursor.description]
        
        # Preparar INSERT para PostgreSQL
        placeholders = ', '.join(['%s'] * len(column_names))
        columns_str = ', '.join(column_names)
        insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
        
        # Insertar datos fila por fila para manejar errores individualmente
        successful_inserts = 0
        for i, row in enumerate(rows):
            try:
                # Convertir valores para compatibilidad con PostgreSQL
                converted_row = []
                for j, value in enumerate(row):
                    converted_value = convert_sqlite_value_to_postgres(value, column_names[j], table_name)
                    converted_row.append(converted_value)
                
                # Usar transacción individual para cada fila
                pg_cursor.execute("BEGIN")
                pg_cursor.execute(insert_sql, tuple(converted_row))
                pg_cursor.execute("COMMIT")
                successful_inserts += 1
            except Exception as e:
                pg_cursor.execute("ROLLBACK")
                log(f"❌ Error insertando fila {i+1} en {table_name}: {e}")
                log(f"   Datos: {dict(zip(column_names, row))}")
                # Continuar con la siguiente fila
                continue
        
        count = successful_inserts
        log(f"✅ Migrados {count} registros de {table_name}")
        
        return count
        
    except Exception as e:
        log(f"❌ Error migrando tabla {table_name}: {e}")
        pg_conn.rollback()
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()

def fix_sequences():
    """Arreglar secuencias de PostgreSQL después de la migración"""
    log("Arreglando secuencias de PostgreSQL...")
    
    pg_conn = psycopg2.connect(**PG_CONFIG)
    pg_cursor = pg_conn.cursor()
    
    try:
        # Obtener tablas con columnas SERIAL
        pg_cursor.execute("""
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND column_default LIKE 'nextval%'
        """)
        
        sequences = pg_cursor.fetchall()
        
        for table_name, column_name in sequences:
            # Obtener el valor máximo actual
            pg_cursor.execute(f"SELECT COALESCE(MAX({column_name}), 0) FROM {table_name}")
            max_val = pg_cursor.fetchone()[0]
            
            # Ajustar secuencia
            sequence_name = f"{table_name}_{column_name}_seq"
            pg_cursor.execute(f"SELECT setval('{sequence_name}', {max_val + 1}, false)")
            
            log(f"✅ Secuencia {sequence_name} ajustada a {max_val + 1}")
        
        pg_conn.commit()
        
    except Exception as e:
        log(f"❌ Error arreglando secuencias: {e}")
        pg_conn.rollback()
    finally:
        pg_conn.close()

def test_migration():
    """Verificar que la migración fue exitosa"""
    log("Verificando migración...")
    
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    pg_conn = psycopg2.connect(**PG_CONFIG)
    
    try:
        # Comparar número de tablas
        sqlite_cursor = sqlite_conn.cursor()
        sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        sqlite_tables = set(row[0] for row in sqlite_cursor.fetchall())
        
        pg_cursor = pg_conn.cursor()
        pg_cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        pg_tables = set(row[0] for row in pg_cursor.fetchall())
        
        missing_tables = sqlite_tables - pg_tables
        if missing_tables:
            log(f"❌ Tablas faltantes en PostgreSQL: {missing_tables}")
            return False
        
        # Comparar número de registros por tabla
        for table in sqlite_tables:
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = sqlite_cursor.fetchone()[0]
            
            pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            pg_count = pg_cursor.fetchone()[0]
            
            if sqlite_count != pg_count:
                log(f"❌ Tabla {table}: SQLite={sqlite_count}, PostgreSQL={pg_count}")
                return False
            else:
                log(f"✅ Tabla {table}: {pg_count} registros migrados correctamente")
        
        return True
        
    finally:
        sqlite_conn.close()
        pg_conn.close()

def main():
    """Función principal de migración"""
    log("🚀 Iniciando migración de SQLite a PostgreSQL")
    
    # Verificar que existe la base de datos SQLite
    if not os.path.exists(SQLITE_DB):
        log(f"❌ Base de datos SQLite no encontrada: {SQLITE_DB}")
        sys.exit(1)
    
    # Verificar conexión a PostgreSQL
    try:
        pg_conn = psycopg2.connect(**PG_CONFIG)
        log(f"✅ Conectado a PostgreSQL: {PG_CONFIG['database']}")
        pg_conn.close()
    except Exception as e:
        log(f"❌ Error conectando a PostgreSQL: {e}")
        sys.exit(1)
    
    try:
        # 1. Obtener tablas de SQLite
        tables = get_sqlite_tables()
        log(f"📋 Encontradas {len(tables)} tablas: {', '.join(tables)}")
        
        # 2. Conectar a PostgreSQL
        pg_conn = psycopg2.connect(**PG_CONFIG)
        pg_cursor = pg_conn.cursor()
        
        # 3. Crear esquemas de tablas
        for table in tables:
            sqlite_columns = get_sqlite_schema(table)
            create_postgres_table(pg_cursor, table, sqlite_columns)
        
        pg_conn.commit()
        pg_conn.close()
        
        # 4. Migrar datos
        total_records = 0
        for table in tables:
            count = migrate_table_data(table)
            total_records += count
        
        # 5. Arreglar secuencias
        fix_sequences()
        
        # 6. Verificar migración
        if test_migration():
            log(f"🎉 Migración completada exitosamente!")
            log(f"📊 Total de registros migrados: {total_records}")
        else:
            log("❌ Falló la verificación de migración")
            sys.exit(1)
            
    except Exception as e:
        log(f"💥 Error durante la migración: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()