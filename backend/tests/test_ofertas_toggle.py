"""
Tests for ofertas toggle functionality
"""
import pytest
from datetime import datetime, timedelta


class TestOfertasToggle:
    """Tests for POST /ofertas/{id}/toggle endpoint"""

    def test_toggle_requires_admin(self, client, user_headers):
        """Non-admin users cannot toggle offers"""
        response = client.post(
            "/api/ofertas/1/toggle",
            headers=user_headers
        )
        assert response.status_code == 403

    def test_toggle_nonexistent_oferta(self, client, auth_headers):
        """Toggling non-existent offer returns 404"""
        response = client.post(
            "/api/ofertas/99999/toggle",
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_toggle_activate_oferta(self, client, auth_headers):
        """Can activate an inactive offer"""
        # Create producto first
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Test Producto Toggle",
            "precio": 100.0,
            "stock": 50
        })
        producto_id = producto_response.json()["id"]

        # Create inactive offer
        hoy = datetime.now().date()
        oferta_response = client.post("/api/ofertas", headers=auth_headers, json={
            "titulo": "Oferta Toggle Test",
            "desde": str(hoy),
            "hasta": str(hoy + timedelta(days=7)),
            "tipo": "porcentaje",
            "descuento_porcentaje": 15,
            "activa": False,
            "productos": [{"producto_id": producto_id, "cantidad": 1}]
        })
        assert oferta_response.status_code == 200
        oferta_id = oferta_response.json()["id"]

        # Toggle to activate
        response = client.post(
            f"/api/ofertas/{oferta_id}/toggle",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["activa"] is True

        # Verify it's activated
        get_response = client.get(f"/api/ofertas/{oferta_id}", headers=auth_headers)
        assert get_response.json()["activa"] == 1

    def test_toggle_deactivate_oferta(self, client, auth_headers):
        """Can deactivate an active offer"""
        # Create producto
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Test Producto Deactivate",
            "precio": 100.0,
            "stock": 50
        })
        producto_id = producto_response.json()["id"]

        # Create active offer
        hoy = datetime.now().date()
        oferta_response = client.post("/api/ofertas", headers=auth_headers, json={
            "titulo": "Oferta Active Test",
            "desde": str(hoy),
            "hasta": str(hoy + timedelta(days=7)),
            "tipo": "porcentaje",
            "descuento_porcentaje": 20,
            "activa": True,
            "productos": [{"producto_id": producto_id, "cantidad": 1}]
        })
        oferta_id = oferta_response.json()["id"]

        # Toggle to deactivate
        response = client.post(
            f"/api/ofertas/{oferta_id}/toggle",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["activa"] is False

        # Verify it's deactivated
        get_response = client.get(f"/api/ofertas/{oferta_id}", headers=auth_headers)
        assert get_response.json()["activa"] == 0

    def test_toggle_expired_oferta_updates_dates(self, client, auth_headers):
        """Activating an expired offer updates dates to start today"""
        # Create producto
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Test Producto Expired",
            "precio": 100.0,
            "stock": 50
        })
        producto_id = producto_response.json()["id"]

        # Create expired offer (dates in the past)
        pasado = datetime.now().date() - timedelta(days=30)
        oferta_response = client.post("/api/ofertas", headers=auth_headers, json={
            "titulo": "Oferta Vencida Test",
            "desde": str(pasado - timedelta(days=7)),
            "hasta": str(pasado),
            "tipo": "porcentaje",
            "descuento_porcentaje": 25,
            "activa": False,
            "productos": [{"producto_id": producto_id, "cantidad": 1}]
        })
        oferta_id = oferta_response.json()["id"]

        # Toggle to activate
        response = client.post(
            f"/api/ofertas/{oferta_id}/toggle",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["activa"] is True
        assert data["fechas_actualizadas"] is True
        assert "desde" in data
        assert "hasta" in data

        # Verify dates were updated
        get_response = client.get(f"/api/ofertas/{oferta_id}", headers=auth_headers)
        oferta_data = get_response.json()
        desde = datetime.fromisoformat(oferta_data["desde"].replace('Z', '+00:00')).date()
        hoy = datetime.now().date()
        assert desde >= hoy

    def test_toggle_multiple_times(self, client, auth_headers):
        """Can toggle offer multiple times"""
        # Create producto
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Test Producto Multiple",
            "precio": 100.0,
            "stock": 50
        })
        producto_id = producto_response.json()["id"]

        # Create offer
        hoy = datetime.now().date()
        oferta_response = client.post("/api/ofertas", headers=auth_headers, json={
            "titulo": "Oferta Multiple Toggle",
            "desde": str(hoy),
            "hasta": str(hoy + timedelta(days=7)),
            "tipo": "porcentaje",
            "descuento_porcentaje": 10,
            "activa": True,
            "productos": [{"producto_id": producto_id, "cantidad": 1}]
        })
        oferta_id = oferta_response.json()["id"]

        # Toggle 1: deactivate
        response1 = client.post(f"/api/ofertas/{oferta_id}/toggle", headers=auth_headers)
        assert response1.json()["activa"] is False

        # Toggle 2: activate
        response2 = client.post(f"/api/ofertas/{oferta_id}/toggle", headers=auth_headers)
        assert response2.json()["activa"] is True

        # Toggle 3: deactivate again
        response3 = client.post(f"/api/ofertas/{oferta_id}/toggle", headers=auth_headers)
        assert response3.json()["activa"] is False
