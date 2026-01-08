"""
One-time migration: Fix localhost URLs in production database
Run this in the backend container on Render
"""
import sqlite3
import os

def migrate_localhost_urls():
    """Replace all localhost:8000 URLs with production domain"""
    db_path = os.getenv("DATABASE_PATH", "/data/ventas.db")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Update productos table
        cursor.execute("""
            UPDATE productos 
            SET imagen_url = REPLACE(imagen_url, 'http://localhost:8000', 'https://api.pedidosfriosur.com')
            WHERE imagen_url LIKE '%localhost:8000%'
        """)
        
        updated = cursor.rowcount
        conn.commit()
        conn.close()
        
        if updated > 0:
            print(f"✅ Migration: Fixed {updated} product image URLs")
        else:
            print("✅ Migration: No localhost URLs found")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate_localhost_urls()
