"""
Tests for Repartidores (delivery drivers) CRUD operations.
"""
import pytest


class TestRepartidores:
    """Test repartidores CRUD operations"""
    
    def test_get_repartidores_empty(self, client, auth_headers):
        """Get repartidores when empty should return empty list"""
        response = client.get("/api/repartidores", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_repartidor(self, client, auth_headers):
        """Create a new repartidor"""
        response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Juan Repartidor",
            "telefono": "099123456",
            "color": "#FF0000"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Juan Repartidor"
        assert data["telefono"] == "099123456"
        assert data["color"] == "#FF0000"
        assert "id" in data
        assert data["activo"] == 1
    
    def test_create_repartidor_minimal(self, client, auth_headers):
        """Create repartidor with only required fields"""
        response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Pedro Repartidor"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Pedro Repartidor"
        assert data["activo"] == 1
    
    def test_create_repartidor_duplicate_name(self, client, auth_headers):
        """Creating repartidor with same name succeeds (depends on implementation)"""
        # Create first
        response1 = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Same Name"
        })
        assert response1.status_code == 201
        
        # Create duplicate - behavior depends on API implementation
        response2 = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Same Name"
        })
        # Should either succeed or return 400 depending on uniqueness constraint
        assert response2.status_code in [201, 400, 409]
    
    def test_get_repartidor_by_id(self, client, auth_headers):
        """Get a specific repartidor by ID"""
        # Create first
        create_response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Carlos Repartidor",
            "telefono": "099888777"
        })
        repartidor_id = create_response.json()["id"]
        
        # Get by ID
        response = client.get(f"/api/repartidores/{repartidor_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == repartidor_id
        assert data["nombre"] == "Carlos Repartidor"
    
    def test_get_repartidor_not_found(self, client, auth_headers):
        """Getting non-existent repartidor returns 404"""
        response = client.get("/api/repartidores/99999", headers=auth_headers)
        assert response.status_code == 404
    
    def test_get_all_repartidores(self, client, auth_headers):
        """Get all repartidores lists created ones"""
        # Create multiple
        client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Repartidor 1"
        })
        client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Repartidor 2"
        })
        client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Repartidor 3"
        })
        
        response = client.get("/api/repartidores", headers=auth_headers)
        assert response.status_code == 200
        repartidores = response.json()
        assert len(repartidores) >= 3
    
    def test_update_repartidor(self, client, auth_headers):
        """Update an existing repartidor"""
        # Create first
        create_response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Original Name",
            "telefono": "099111111",
            "color": "#000000"
        })
        repartidor_id = create_response.json()["id"]
        
        # Update
        response = client.put(f"/api/repartidores/{repartidor_id}", headers=auth_headers, json={
            "nombre": "Updated Name",
            "telefono": "099222222",
            "color": "#FFFFFF"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "Updated Name"
        assert data["telefono"] == "099222222"
        assert data["color"] == "#FFFFFF"
    
    def test_update_repartidor_partial(self, client, auth_headers):
        """Update repartidor with only some fields"""
        # Create first
        create_response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "Test Repartidor",
            "telefono": "099000000"
        })
        repartidor_id = create_response.json()["id"]
        
        # Update only name
        response = client.put(f"/api/repartidores/{repartidor_id}", headers=auth_headers, json={
            "nombre": "New Name"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "New Name"
        # Original phone should be preserved
        assert data["telefono"] == "099000000"
    
    def test_update_repartidor_not_found(self, client, auth_headers):
        """Updating non-existent repartidor returns 404"""
        response = client.put("/api/repartidores/99999", headers=auth_headers, json={
            "nombre": "New Name"
        })
        assert response.status_code == 404
    
    def test_delete_repartidor_requires_admin(self, client, user_headers):
        """Delete requires admin role"""
        response = client.delete("/api/repartidores/1", headers=user_headers)
        assert response.status_code == 403
    
    def test_delete_repartidor(self, client, auth_headers):
        """Admin can delete repartidor"""
        # Create first
        create_response = client.post("/api/repartidores", headers=auth_headers, json={
            "nombre": "To Delete"
        })
        repartidor_id = create_response.json()["id"]
        
        # Delete
        response = client.delete(f"/api/repartidores/{repartidor_id}", headers=auth_headers)
        assert response.status_code == 200
        
        # Verify it's deactivated (not returned in default list)
        get_response = client.get("/api/repartidores", headers=auth_headers)
        repartidores = get_response.json()
        # Should not be in active list
        assert not any(r["id"] == repartidor_id for r in repartidores if r.get("activo", 1) == 1)
    
    def test_delete_repartidor_not_found(self, client, auth_headers):
        """Deleting non-existent repartidor returns 404"""
        response = client.delete("/api/repartidores/99999", headers=auth_headers)
        assert response.status_code == 404
