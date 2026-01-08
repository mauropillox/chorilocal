#!/usr/bin/env python3
"""
Migración simplificada de SQLite a PostgreSQL
Enfoque directo sin conversión automática de tipos
"""

import os
import sqlite3
import psycopg2
from datetime import datetime

# Configuración
SQLITE_DB = os.getenv('SQLITE_DB_PATH', '../data/ventas.db')
PG_CONFIG = {
    'host': 'localhost',
    'database': 'chorizaurio_db',
    'user': 'chorizaurio',
    'password': os.getenv('PG_PASSWORD', 'chorizaurio123')
}

def log(message):
    """Log con timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def test_connections():
    """Probar conexiones a ambas bases de datos"""
    log("Probando conexiones...")
    
    # SQLite
    try:
        sqlite_conn = sqlite3.connect(SQLITE_DB)
        sqlite_cursor = sqlite_conn.cursor()
        sqlite_cursor.execute("SELECT COUNT(*) FROM pedidos")
        pedidos_count = sqlite_cursor.fetchone()[0]
        sqlite_conn.close()
        log(f"✅ SQLite conectado: {pedidos_count} pedidos")
    except Exception as e:
        log(f"❌ Error conectando a SQLite: {e}")
        return False
    
    # PostgreSQL
    try:
        pg_conn = psycopg2.connect(**PG_CONFIG)
        pg_cursor = pg_conn.cursor()
        pg_cursor.execute("SELECT version()")
        version = pg_cursor.fetchone()[0]
        pg_conn.close()
        log(f"✅ PostgreSQL conectado: {version}")
    except Exception as e:
        log(f"❌ Error conectando a PostgreSQL: {e}")
        return False
    
    return True

def create_schema():
    """Crear schema completo en PostgreSQL"""
    log("Creando schema en PostgreSQL...")
    
    # SQL para recrear estructura
    schema_sql = """
    -- Borrar tablas si existen (en orden)
    DROP TABLE IF EXISTS productos_tags CASCADE;
    DROP TABLE IF EXISTS tags CASCADE;
    DROP TABLE IF EXISTS revoked_tokens CASCADE;
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS categorias CASCADE;
    DROP TABLE IF EXISTS detalles_template CASCADE;
    DROP TABLE IF EXISTS pedidos_template CASCADE;
    DROP TABLE IF EXISTS precios_lista CASCADE;
    DROP TABLE IF EXISTS listas_precios CASCADE;
    DROP TABLE IF EXISTS historial_pedidos CASCADE;
    DROP TABLE IF EXISTS oferta_productos CASCADE;
    DROP TABLE IF EXISTS ofertas CASCADE;
    DROP TABLE IF EXISTS usuarios CASCADE;
    DROP TABLE IF EXISTS detalles_pedido CASCADE;
    DROP TABLE IF EXISTS pedidos CASCADE;
    DROP TABLE IF EXISTS productos CASCADE;
    DROP TABLE IF EXISTS clientes CASCADE;
    
    -- Clientes
    CREATE TABLE clientes (
        id SERIAL PRIMARY KEY,
        nombre TEXT,
        telefono TEXT,
        direccion TEXT,
        lista_precio_id INTEGER,
        zona TEXT
    );
    
    -- Productos (con nombres correctos)
    CREATE TABLE productos (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        precio REAL NOT NULL,
        imagen_url TEXT,
        stock INTEGER DEFAULT 0,
        stock_minimo REAL DEFAULT 10,
        stock_tipo TEXT DEFAULT 'unidad',
        categoria_id INTEGER
    );
    
    -- Pedidos (con campos BOOLEAN corregidos)
    CREATE TABLE pedidos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL,
        fecha TIMESTAMP NOT NULL,
        pdf_generado BOOLEAN DEFAULT FALSE,
        observaciones TEXT,
        pdf_descargado BOOLEAN DEFAULT FALSE,
        usuario_id INTEGER,
        fecha_creacion TEXT,
        fecha_generacion TEXT,
        creado_por TEXT,
        generado_por TEXT,
        notas TEXT,
        dispositivo TEXT,
        user_agent TEXT,
        ultimo_editor TEXT,
        fecha_ultima_edicion TEXT,
        estado TEXT DEFAULT 'pendiente',
        repartidor TEXT,
        fecha_entrega TEXT
    );
    
    -- Detalles pedido (con nombres correctos y producto_id nullable)
    CREATE TABLE detalles_pedido (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER,
        cantidad REAL NOT NULL,
        tipo TEXT DEFAULT 'unidad'
    );
    
    -- Usuarios (con campo BOOLEAN corregido)
    CREATE TABLE usuarios (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP
    );
    
    -- Ofertas (con nombres correctos)
    CREATE TABLE ofertas (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        desde TEXT NOT NULL,
        hasta TEXT NOT NULL,
        activa INTEGER DEFAULT 1,
        descuento_porcentaje REAL DEFAULT 10
    );
    
    -- Oferta productos
    CREATE TABLE oferta_productos (
        oferta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL DEFAULT 1,
        PRIMARY KEY (oferta_id, producto_id)
    );
    
    -- Historial pedidos (con nombres correctos)
    CREATE TABLE historial_pedidos (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL,
        accion TEXT NOT NULL,
        usuario TEXT NOT NULL,
        fecha TEXT NOT NULL,
        detalles TEXT
    );
    
    -- Listas precios (con nombres correctos)
    CREATE TABLE listas_precios (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        multiplicador REAL DEFAULT 1.0,
        activa INTEGER DEFAULT 1,
        fecha_creacion TEXT
    );
    
    -- Precios lista
    CREATE TABLE precios_lista (
        id SERIAL PRIMARY KEY,
        lista_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        precio REAL NOT NULL
    );
    
    -- Pedidos template (con nombres correctos)
    CREATE TABLE pedidos_template (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        cliente_id INTEGER,
        frecuencia TEXT,
        activo INTEGER DEFAULT 1,
        ultima_ejecucion TEXT,
        proxima_ejecucion TEXT,
        creado_por TEXT,
        fecha_creacion TEXT
    );
    
    -- Detalles template (con nombres correctos)
    CREATE TABLE detalles_template (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad REAL NOT NULL,
        tipo TEXT DEFAULT 'unidad'
    );
    
    -- Categorias (con nombres correctos)
    CREATE TABLE categorias (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        color TEXT DEFAULT '#6366f1',
        orden INTEGER DEFAULT 0,
        activa INTEGER DEFAULT 1,
        fecha_creacion TEXT
    );
    
    -- Audit log (con nombres correctos)
    CREATE TABLE audit_log (
        id SERIAL PRIMARY KEY,
        timestamp TEXT NOT NULL,
        usuario TEXT NOT NULL,
        accion TEXT NOT NULL,
        tabla TEXT NOT NULL,
        registro_id INTEGER,
        datos_antes TEXT,
        datos_despues TEXT,
        ip_address TEXT,
        user_agent TEXT
    );
    
    -- Revoked tokens
    CREATE TABLE revoked_tokens (
        id SERIAL PRIMARY KEY,
        token_jti TEXT UNIQUE NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tags (con nombres correctos)
    CREATE TABLE tags (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icono TEXT DEFAULT '🏷️',
        tipo TEXT DEFAULT 'producto'
    );
    
    -- Productos tags
    CREATE TABLE productos_tags (
        producto_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (producto_id, tag_id)
    );
    
    -- SQLite sequence (solo para compatibilidad)
    CREATE TABLE sqlite_sequence (
        name TEXT,
        seq INTEGER
    );
    """
    
    try:
        pg_conn = psycopg2.connect(**PG_CONFIG)
        pg_cursor = pg_conn.cursor()
        pg_cursor.execute(schema_sql)
        pg_conn.commit()
        pg_conn.close()
        log("✅ Schema creado exitosamente")
        return True
    except Exception as e:
        log(f"❌ Error creando schema: {e}")
        return False

def convert_value(value, table, column):
    """Convertir valores específicos para PostgreSQL"""
    if value is None:
        return None
    
    # Campos booleanos
    boolean_fields = {
        'pedidos': ['pdf_generado', 'pdf_descargado'],
        'productos': ['activo'],
        'usuarios': ['activo']
    }
    
    if table in boolean_fields and column in boolean_fields[table]:
        return bool(value)
    
    return value

def migrate_table(table_name):
    """Migrar datos de una tabla específica"""
    log(f"Migrando tabla {table_name}...")
    
    # Conectar a SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # Conectar a PostgreSQL
    pg_conn = psycopg2.connect(**PG_CONFIG)
    pg_cursor = pg_conn.cursor()
    
    try:
        # Obtener datos de SQLite
        sqlite_cursor.execute(f"SELECT * FROM {table_name}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            log(f"⚠️  Tabla {table_name} está vacía")
            return 0
        
        # Obtener nombres de columnas
        column_names = list(rows[0].keys())
        
        # Preparar INSERT
        placeholders = ', '.join(['%s'] * len(column_names))
        columns_str = ', '.join(column_names)
        insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
        
        # Insertar datos con transacciones individuales
        successful = 0
        for row in rows:
            try:
                # Convertir valores
                converted_values = []
                for i, col in enumerate(column_names):
                    converted_value = convert_value(row[i], table_name, col)
                    converted_values.append(converted_value)
                
                # Transacción individual para cada fila
                pg_cursor.execute("BEGIN")
                pg_cursor.execute(insert_sql, converted_values)
                pg_cursor.execute("COMMIT")
                successful += 1
                
            except Exception as e:
                pg_cursor.execute("ROLLBACK")
                log(f"❌ Error en fila de {table_name}: {e}")
                continue
        
        log(f"✅ Migrados {successful} registros de {table_name}")
        return successful
        
    finally:
        sqlite_conn.close()
        pg_conn.close()

def fix_sequences():
    """Arreglar secuencias de PostgreSQL"""
    log("Arreglando secuencias...")
    
    sequences = [
        ('clientes', 'clientes_id_seq'),
        ('productos', 'productos_id_seq'),
        ('pedidos', 'pedidos_id_seq'),
        ('detalles_pedido', 'detalles_pedido_id_seq'),
        ('usuarios', 'usuarios_id_seq'),
        ('ofertas', 'ofertas_id_seq'),
        ('historial_pedidos', 'historial_pedidos_id_seq'),
        ('listas_precios', 'listas_precios_id_seq'),
        ('precios_lista', 'precios_lista_id_seq'),
        ('pedidos_template', 'pedidos_template_id_seq'),
        ('detalles_template', 'detalles_template_id_seq'),
        ('categorias', 'categorias_id_seq'),
        ('audit_log', 'audit_log_id_seq'),
        ('revoked_tokens', 'revoked_tokens_id_seq'),
        ('tags', 'tags_id_seq')
    ]
    
    pg_conn = psycopg2.connect(**PG_CONFIG)
    pg_cursor = pg_conn.cursor()
    
    try:
        for table, sequence in sequences:
            # Obtener máximo ID
            pg_cursor.execute(f"SELECT COALESCE(MAX(id), 0) + 1 FROM {table}")
            next_val = pg_cursor.fetchone()[0]
            
            # Ajustar secuencia
            pg_cursor.execute(f"SELECT setval('{sequence}', {next_val})")
            log(f"✅ Secuencia {sequence} ajustada a {next_val}")
        
        pg_conn.commit()
    
    finally:
        pg_conn.close()

def verify_migration():
    """Verificar que la migración fue exitosa"""
    log("Verificando migración...")
    
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    pg_conn = psycopg2.connect(**PG_CONFIG)
    
    try:
        tables = ['clientes', 'productos', 'pedidos', 'detalles_pedido', 'usuarios',
                 'ofertas', 'oferta_productos', 'historial_pedidos', 'listas_precios',
                 'precios_lista', 'pedidos_template', 'detalles_template', 'categorias',
                 'audit_log', 'revoked_tokens', 'tags', 'productos_tags']
        
        all_good = True
        for table in tables:
            # Contar SQLite
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = sqlite_cursor.fetchone()[0]
            
            # Contar PostgreSQL
            pg_cursor = pg_conn.cursor()
            pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            pg_count = pg_cursor.fetchone()[0]
            
            if sqlite_count == pg_count:
                log(f"✅ {table}: {pg_count} registros")
            else:
                log(f"❌ {table}: SQLite={sqlite_count}, PostgreSQL={pg_count}")
                all_good = False
        
        return all_good
    
    finally:
        sqlite_conn.close()
        pg_conn.close()

def main():
    """Función principal"""
    log("🚀 Iniciando migración simplificada")
    
    if not test_connections():
        return False
    
    if not create_schema():
        return False
    
    # Orden de migración (respetando foreign keys)
    tables = [
        'clientes', 'productos', 'usuarios', 'listas_precios', 'precios_lista',
        'categorias', 'ofertas', 'oferta_productos', 'tags', 'productos_tags',
        'pedidos', 'detalles_pedido', 'historial_pedidos', 
        'pedidos_template', 'detalles_template', 'audit_log', 'revoked_tokens'
    ]
    
    for table in tables:
        migrate_table(table)
    
    fix_sequences()
    
    if verify_migration():
        log("🎉 Migración completada exitosamente")
        return True
    else:
        log("❌ La migración falló la verificación")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)