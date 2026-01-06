"""
Tests for database functions and integrity.
"""
import pytest


class TestDatabaseSchema:
    """Test database schema creation and migrations"""
    
    def test_ensure_schema_creates_tables(self, temp_db):
        """ensure_schema should create all required tables"""
        import db
        
        # Verify tables exist
        con = db.conectar()
        cur = con.cursor()
        
        cur.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            ORDER BY name
        """)
        tables = {row['name'] for row in cur.fetchall()}
        
        # Check essential tables
        assert 'clientes' in tables
        assert 'productos' in tables
        assert 'pedidos' in tables
        assert 'usuarios' in tables
        assert 'categorias' in tables
        assert 'ofertas' in tables
        assert 'audit_log' in tables
        assert 'revoked_tokens' in tables  # New table for logout
        
        con.close()
    
    def test_revoked_tokens_table_structure(self, temp_db):
        """revoked_tokens table should have correct structure"""
        import db
        
        con = db.conectar()
        cur = con.cursor()
        
        # Check columns
        cur.execute("PRAGMA table_info(revoked_tokens)")
        columns = {row['name'] for row in cur.fetchall()}
        
        assert 'jti' in columns
        assert 'revoked_at' in columns
        assert 'expires_at' in columns
        assert 'username' in columns
        
        con.close()


class TestTokenRevocation:
    """Test token blacklist functionality"""
    
    def test_revoke_token(self, temp_db):
        """Should be able to revoke a token"""
        import db
        
        jti = "test-token-id-12345"
        result = db.revoke_token(jti, "2025-12-31T23:59:59", "testuser")
        assert result is True
    
    def test_is_token_revoked(self, temp_db):
        """Should correctly identify revoked tokens"""
        import db
        
        # Token not revoked yet
        assert db.is_token_revoked("new-token") is False
        
        # Revoke it
        db.revoke_token("new-token", "2025-12-31T23:59:59", "testuser")
        
        # Now it should be revoked
        assert db.is_token_revoked("new-token") is True
    
    def test_cleanup_expired_tokens(self, temp_db):
        """Should remove expired tokens"""
        import db
        
        # Add an expired token (past date)
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO revoked_tokens (jti, revoked_at, expires_at, username)
            VALUES (?, ?, ?, ?)
        """, ("expired-token", "2020-01-01T00:00:00", "2020-01-01T01:00:00", "testuser"))
        con.commit()
        con.close()
        
        # Verify it exists
        assert db.is_token_revoked("expired-token") is True
        
        # Cleanup
        cleaned = db.cleanup_expired_tokens()
        assert cleaned >= 1
        
        # Should be gone now
        assert db.is_token_revoked("expired-token") is False


class TestBatchStockUpdate:
    """Test atomic stock updates"""
    
    def test_batch_update_stock_restar(self, temp_db):
        """Should atomically subtract stock from multiple products"""
        import db
        
        # Create products with stock
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO productos (nombre, precio, stock)
            VALUES ('Prod1', 100, 50), ('Prod2', 200, 30)
        """)
        con.commit()
        con.close()
        
        # Get product IDs
        productos = db.get_productos()
        prod1_id = next(p['id'] for p in productos if p['nombre'] == 'Prod1')
        prod2_id = next(p['id'] for p in productos if p['nombre'] == 'Prod2')
        
        # Subtract stock
        result = db.batch_update_stock_atomic([
            {"id": prod1_id, "cantidad": 10},
            {"id": prod2_id, "cantidad": 5}
        ], operacion="restar")
        
        assert result["ok"] is True
        assert result["count"] == 2
        
        # Verify stock was updated
        prod1 = db.get_producto_by_id(prod1_id)
        prod2 = db.get_producto_by_id(prod2_id)
        
        assert prod1["stock"] == 40
        assert prod2["stock"] == 25
    
    def test_batch_update_stock_rollback_on_missing_product(self, temp_db):
        """Should rollback if a product doesn't exist"""
        import db
        
        # Create one product
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO productos (nombre, precio, stock)
            VALUES ('ExistingProd', 100, 50)
        """)
        con.commit()
        con.close()
        
        productos = db.get_productos()
        existing_id = productos[0]['id']
        
        # Try to update existing and non-existing
        result = db.batch_update_stock_atomic([
            {"id": existing_id, "cantidad": 10},
            {"id": 99999, "cantidad": 5}  # Non-existent
        ], operacion="restar")
        
        assert "error" in result
        
        # Original product should not have changed (rollback)
        prod = db.get_producto_by_id(existing_id)
        assert prod["stock"] == 50  # Unchanged


class TestAuditLog:
    """Test audit logging functionality"""
    
    def test_audit_log_entry(self, temp_db):
        """Should create audit log entries"""
        import db
        
        db.audit_log(
            usuario="testuser",
            accion="TEST_ACTION",
            tabla="productos",
            registro_id=1,
            datos_antes={"old": "value"},
            datos_despues={"new": "value"},
            ip_address="127.0.0.1"
        )
        
        # Verify entry was created
        con = db.conectar()
        cur = con.cursor()
        cur.execute("SELECT * FROM audit_log WHERE accion = 'TEST_ACTION'")
        row = cur.fetchone()
        con.close()
        
        assert row is not None
        assert row["usuario"] == "testuser"
        assert row["tabla"] == "productos"


class TestValidTables:
    """Test table whitelist security"""
    
    def test_valid_tables_whitelist(self, temp_db):
        """VALID_TABLES should contain all expected tables"""
        import db
        
        expected_tables = {
            'clientes', 'productos', 'pedidos', 'detalles_pedido', 
            'usuarios', 'categorias', 'ofertas', 'audit_log', 
            'historial_pedidos', 'revoked_tokens'
        }
        
        for table in expected_tables:
            assert table in db.VALID_TABLES, f"Missing table: {table}"
