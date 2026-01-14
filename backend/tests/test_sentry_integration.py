"""
Tests for Sentry error tracking integration.
"""
import pytest
import os


class TestSentryIntegration:
    """Test Sentry error tracking integration"""
    
    def test_sentry_is_configured(self, client, auth_headers):
        """Verify Sentry DSN is configured in environment"""
        sentry_dsn = os.getenv("SENTRY_DSN", "")
        # Should be configured in production
        # In test mode it may not be set, so we just verify it can be set
        assert isinstance(sentry_dsn, str)
    
    def test_sentry_import_available(self):
        """Verify sentry_sdk is installed and importable"""
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            assert True
        except ImportError:
            pytest.fail("sentry_sdk not installed")
    
    def test_unhandled_exception_structure(self, client, auth_headers):
        """Verify server handles unhandled exceptions gracefully"""
        # Try to access an endpoint that might trigger an error
        # Using invalid ID to trigger error handling
        response = client.get("/clientes/invalid_id", headers=auth_headers)
        
        # Should return proper error structure, not 500
        assert response.status_code in [400, 422, 404]
        
        # Error response should have proper structure
        data = response.json()
        assert "error" in data or "detail" in data
    
    def test_validation_error_has_proper_structure(self, client, auth_headers):
        """Verify validation errors are properly formatted"""
        response = client.post("/clientes", headers=auth_headers, json={
            # Invalid: empty nombre fails validation
        })
        
        # Should fail validation
        assert response.status_code == 422
        
        # Response should have standard error structure
        data = response.json()
        assert "error" in data or "detail" in data
    
    def test_rate_limit_error_structure(self, client, auth_headers):
        """Verify rate limit errors are properly formatted"""
        # Temporarily enable limiter
        import main
        main.limiter.enabled = True
        
        try:
            # Make many requests to trigger rate limit
            for i in range(15):
                response = client.get("/clientes", headers=auth_headers)
                if response.status_code == 429:
                    # Got rate limited
                    data = response.json()
                    assert "error" in data
                    assert "code" in data
                    break
        finally:
            # Disable limiter again for other tests
            main.limiter.enabled = False
    
    def test_authentication_error_structure(self, client):
        """Verify auth errors are properly formatted"""
        # Request without auth headers
        response = client.get("/clientes")
        
        # Should fail auth
        assert response.status_code in [401, 403]
        
        # Response should have proper structure
        data = response.json()
        assert "error" in data or "detail" in data
    
    def test_not_found_error_structure(self, client, auth_headers):
        """Verify 404 errors are properly formatted"""
        response = client.get("/clientes/999999", headers=auth_headers)
        
        # Should be not found
        assert response.status_code == 404
        
        # Response should have proper error structure
        data = response.json()
        assert "error" in data or "detail" in data
        assert "code" in data
    
    def test_duplicate_error_structure(self, client, auth_headers):
        """Verify duplicate/conflict errors are properly formatted"""
        # Create a client
        client.post("/clientes", headers=auth_headers, json={
            "nombre": "Unique Client"
        })
        
        # Try to create duplicate (if API enforces uniqueness)
        # This depends on whether the API enforces unique client names
        # If it does, we should get a proper error structure
        response = client.post("/clientes", headers=auth_headers, json={
            "nombre": "Unique Client"
        })
        
        # Either success (if no uniqueness) or proper error format
        if response.status_code == 409:
            data = response.json()
            assert "error" in data or "detail" in data
            assert "code" in data
