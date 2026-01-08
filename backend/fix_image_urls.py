"""
Fix product image URLs - Replace localhost:8000 with production domain
"""
import sqlite3
import sys

def fix_image_urls(db_path: str, dry_run: bool = True):
    """Update all localhost:8000 URLs to production URLs"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find all products with localhost URLs
    cursor.execute("""
        SELECT id, nombre, imagen_url 
        FROM productos 
        WHERE imagen_url LIKE '%localhost:8000%'
    """)
    
    products = cursor.fetchall()
    
    if not products:
        print("✅ No products with localhost URLs found")
        return
    
    print(f"Found {len(products)} products with localhost URLs:\n")
    
    for prod_id, nombre, old_url in products:
        # Replace localhost:8000 with production URL
        new_url = old_url.replace('http://localhost:8000', 'https://api.pedidosfriosur.com')
        
        print(f"ID {prod_id}: {nombre}")
        print(f"  OLD: {old_url}")
        print(f"  NEW: {new_url}\n")
        
        if not dry_run:
            cursor.execute(
                "UPDATE productos SET imagen_url = ? WHERE id = ?",
                (new_url, prod_id)
            )
    
    if dry_run:
        print("🔍 DRY RUN - No changes made")
        print("Run with --fix to apply changes")
    else:
        conn.commit()
        print(f"✅ Updated {len(products)} product URLs")
    
    conn.close()


if __name__ == "__main__":
    import os
    
    db_path = os.getenv("DATABASE_PATH", "/data/ventas.db")
    dry_run = "--fix" not in sys.argv
    
    print(f"Database: {db_path}")
    print(f"Mode: {'DRY RUN' if dry_run else 'FIXING'}\n")
    
    fix_image_urls(db_path, dry_run)
