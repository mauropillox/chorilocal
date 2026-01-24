"""
Migration: Add advanced offer types to ofertas table

Adds columns to support:
- Different offer types (porcentaje, precio_cantidad, nxm, regalo)
- Custom pricing rules
- Buy N get M offers
- Gift with purchase

Date: 2026-01-24
"""
import sqlite3
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def migrate():
    """Apply migration to add new ofertas columns"""
    
    # Connect to production database
    db_path = os.environ.get('DATABASE_PATH', '/data/ventas.db')
    
    if not os.path.exists(db_path):
        print(f"⚠️  Database not found at {db_path}")
        db_path = 'ventas.db'  # Fallback to local
        
    print(f"📊 Connecting to database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current table structure
        cursor.execute("PRAGMA table_info(ofertas)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        print(f"✅ Current columns: {existing_columns}")
        
        # Add new columns if they don't exist
        new_columns = {
            'tipo': "ALTER TABLE ofertas ADD COLUMN tipo TEXT DEFAULT 'porcentaje'",
            'reglas_json': "ALTER TABLE ofertas ADD COLUMN reglas_json TEXT",
            'compra_cantidad': "ALTER TABLE ofertas ADD COLUMN compra_cantidad INTEGER",
            'paga_cantidad': "ALTER TABLE ofertas ADD COLUMN paga_cantidad INTEGER",
            'regalo_producto_id': "ALTER TABLE ofertas ADD COLUMN regalo_producto_id INTEGER",
            'regalo_cantidad': "ALTER TABLE ofertas ADD COLUMN regalo_cantidad INTEGER DEFAULT 1"
        }
        
        added = []
        skipped = []
        
        for col_name, sql in new_columns.items():
            if col_name not in existing_columns:
                print(f"📝 Adding column: {col_name}")
                cursor.execute(sql)
                added.append(col_name)
            else:
                print(f"⊘  Column already exists: {col_name}")
                skipped.append(col_name)
        
        conn.commit()
        
        # Verify new structure
        cursor.execute("PRAGMA table_info(ofertas)")
        final_columns = {row[1] for row in cursor.fetchall()}
        
        print(f"\n✅ Migration complete!")
        print(f"   Added: {added if added else 'None (all existed)'}")
        print(f"   Skipped: {skipped if skipped else 'None'}")
        print(f"   Final columns: {final_columns}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

def rollback():
    """Rollback migration (remove added columns)"""
    print("⚠️  SQLite doesn't support DROP COLUMN easily")
    print("   To rollback, restore from backup")
    return False

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate ofertas table')
    parser.add_argument('action', choices=['migrate', 'rollback'], 
                       help='Action to perform')
    
    args = parser.parse_args()
    
    if args.action == 'migrate':
        success = migrate()
        sys.exit(0 if success else 1)
    else:
        success = rollback()
        sys.exit(0 if success else 1)
