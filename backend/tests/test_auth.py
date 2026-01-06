"""
Tests for authentication endpoints and security.
"""
import pytest


class TestHealth:
    """Test health check endpoints"""
    
    def test_health_endpoint(self, client):
        """Health endpoint should return 200"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestAuthentication:
    """Test login, logout, and token management"""
    
    def test_login_success(self, client, temp_db):
        """Valid credentials should return token"""
        import db
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create test user
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("logintest", pwd_context.hash("password123"), "user", 1))
        con.commit()
        con.close()
        
        response = client.post("/login", data={
            "username": "logintest",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_wrong_password(self, client, temp_db):
        """Wrong password should return 401"""
        import db
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("wrongpass", pwd_context.hash("correctpass"), "user", 1))
        con.commit()
        con.close()
        
        response = client.post("/login", data={
            "username": "wrongpass",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_login_inactive_user(self, client, temp_db):
        """Inactive user should return 403"""
        import db
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("inactiveuser", pwd_context.hash("password"), "user", 0))
        con.commit()
        con.close()
        
        response = client.post("/login", data={
            "username": "inactiveuser",
            "password": "password"
        })
        assert response.status_code == 403
    
    def test_logout(self, client, admin_token):
        """Logout should invalidate token"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Verify token works
        response = client.get("/clientes", headers=headers)
        assert response.status_code == 200
        
        # Logout
        response = client.post("/logout", headers=headers)
        assert response.status_code == 200
        
        # Token should now be rejected
        response = client.get("/clientes", headers=headers)
        assert response.status_code == 401
    
    def test_protected_endpoint_without_token(self, client, temp_db):
        """Protected endpoints should require authentication"""
        response = client.get("/clientes")
        assert response.status_code == 401


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limit_returns_429(self, client, temp_db):
        """When rate limited, should return 429 not 500"""
        import main
        
        # Re-enable limiter for this test
        main.limiter.enabled = True
        main.limiter._storage.reset()
        
        # Make many rapid requests to trigger rate limit
        responses = []
        for _ in range(15):  # Login is limited to 10/minute
            response = client.post("/login", data={
                "username": "fake",
                "password": "fake"
            })
            responses.append(response.status_code)
        
        # Should have some 429 responses
        assert 429 in responses, f"Expected 429 in responses but got: {set(responses)}"
        
        # Disable limiter again
        main.limiter.enabled = False


class TestSQLInjectionPrevention:
    """Test SQL injection protections"""
    
    def test_ensure_column_validates_identifier(self, temp_db):
        """_ensure_column should reject invalid SQL identifiers"""
        import db
        
        # Valid identifiers should work
        con = db.conectar()
        cur = con.cursor()
        
        # Invalid identifiers should raise ValueError
        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            db._validate_sql_identifier("'; DROP TABLE users; --", "test")
        
        with pytest.raises(ValueError, match="Invalid SQL identifier"):
            db._validate_sql_identifier("123invalid", "test")
        
        # Valid identifiers should pass
        db._validate_sql_identifier("valid_column", "test")  # Should not raise
        db._validate_sql_identifier("_private", "test")  # Should not raise
        
        con.close()
    
    def test_ensure_column_validates_type(self, temp_db):
        """_ensure_column should reject invalid SQL types"""
        import db
        
        # Invalid types should raise ValueError
        with pytest.raises(ValueError, match="Invalid SQL type"):
            db._validate_type_def("MALICIOUS; DROP TABLE users")
        
        with pytest.raises(ValueError, match="Invalid SQL type"):
            db._validate_type_def("VARCHAR(255)")  # Not in allowed list
        
        # Semicolons in type definition get caught at base type validation
        with pytest.raises(ValueError, match="Invalid SQL type"):
            db._validate_type_def("TEXT; DROP TABLE usuarios")
        
        # SQL injection keywords as modifiers should be rejected
        with pytest.raises(ValueError, match="Unsafe modifier"):
            db._validate_type_def("INTEGER DROP")  # DROP is not a valid modifier
        
        # Valid types should pass
        db._validate_type_def("TEXT")  # Should not raise
        db._validate_type_def("INTEGER DEFAULT 0")  # Should not raise
        db._validate_type_def("TEXT NOT NULL")  # Should not raise
        db._validate_type_def("BOOLEAN DEFAULT 1")  # Should not raise


class TestTokenRevocation:
    """Test token blacklist functionality"""
    
    def test_revoke_token(self, temp_db):
        """revoke_token should add token to blacklist"""
        import db
        from datetime import datetime, timedelta, timezone
        
        jti = "test-jti-12345"
        expires = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)).isoformat()
        
        # Token should not be revoked initially
        assert db.is_token_revoked(jti) is False
        
        # Revoke the token
        result = db.revoke_token(jti, expires, "testuser")
        assert result is True
        
        # Token should now be revoked
        assert db.is_token_revoked(jti) is True
    
    def test_duplicate_revoke_ignored(self, temp_db):
        """Revoking same token twice should not error"""
        import db
        from datetime import datetime, timedelta, timezone
        
        jti = "test-jti-duplicate"
        expires = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)).isoformat()
        
        # First revoke
        db.revoke_token(jti, expires, "testuser")
        
        # Second revoke should return False (already exists)
        result = db.revoke_token(jti, expires, "testuser")
        assert result is False
    
    def test_cleanup_expired_tokens(self, temp_db):
        """cleanup_expired_tokens should remove old tokens"""
        import db
        from datetime import datetime, timedelta, timezone
        
        # Add an expired token
        jti_expired = "expired-token"
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        expired_time = (now_utc - timedelta(hours=1)).isoformat()
        
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO revoked_tokens (jti, revoked_at, expires_at, username)
            VALUES (?, ?, ?, ?)
        """, (jti_expired, now_utc.isoformat(), expired_time, "test"))
        con.commit()
        con.close()
        
        # Cleanup should remove it
        cleaned = db.cleanup_expired_tokens()
        assert cleaned >= 1
        
        # Token should no longer be in the list (already expired)
        assert db.is_token_revoked(jti_expired) is False


class TestAtomicUserCheck:
    """Test atomic user + token validation"""
    
    def test_get_active_user_if_token_valid_success(self, temp_db):
        """Should return user when active and token not revoked"""
        import db
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create active user
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("activeuser", pwd_context.hash("pass"), "user", 1))
        con.commit()
        con.close()
        
        # Check with valid token (not revoked)
        result = db.get_active_user_if_token_valid("activeuser", "valid-jti")
        assert result is not None
        assert result["username"] == "activeuser"
        assert result["activo"] is True
    
    def test_get_active_user_if_token_valid_inactive_user(self, temp_db):
        """Should return None when user is inactive"""
        import db
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create inactive user
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("inactiveuser2", pwd_context.hash("pass"), "user", 0))
        con.commit()
        con.close()
        
        # Should return None for inactive user
        result = db.get_active_user_if_token_valid("inactiveuser2", "some-jti")
        assert result is None
    
    def test_get_active_user_if_token_valid_revoked_token(self, temp_db):
        """Should return None when token is revoked"""
        import db
        from passlib.context import CryptContext
        from datetime import datetime, timedelta, timezone
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # Create active user
        con = db.conectar()
        cur = con.cursor()
        cur.execute("""
            INSERT INTO usuarios (username, password_hash, rol, activo)
            VALUES (?, ?, ?, ?)
        """, ("userrevoked", pwd_context.hash("pass"), "user", 1))
        con.commit()
        con.close()
        
        # Revoke the token
        jti = "revoked-jti-test"
        expires = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)).isoformat()
        db.revoke_token(jti, expires, "userrevoked")
        
        # Should return None because token is revoked
        result = db.get_active_user_if_token_valid("userrevoked", jti)
        assert result is None
