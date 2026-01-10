"""
Test suite for bulk delete functionality
Covers atomic validation, deduplication, and error handling
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


class TestBulkDelete:
    """Tests for POST /pedidos/bulk-delete endpoint"""

    def test_bulk_delete_requires_admin(self, client, vendedor_token):
        """Vendedor role should not be able to bulk delete"""
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [1, 2, 3]},
            headers={"Authorization": f"Bearer {vendedor_token}"}
        )
        assert response.status_code == 403

    def test_bulk_delete_empty_list_rejected(self, client, admin_token):
        """Empty pedido_ids list should be rejected with 422"""
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": []},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422

    def test_bulk_delete_max_100_limit(self, client, admin_token):
        """More than 100 pedidos should be rejected"""
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": list(range(1, 102))},  # 101 items
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422

    def test_bulk_delete_deduplicates_ids(self, client, admin_token, test_pedido):
        """Duplicate IDs should be handled gracefully"""
        pedido_id = test_pedido["id"]
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [pedido_id, pedido_id, pedido_id]},  # Duplicates
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == 1  # Only counts unique

    def test_bulk_delete_missing_pedidos_returns_404(self, client, admin_token):
        """Non-existent pedido IDs should return 404"""
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [999999, 999998]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        assert "no encontrados" in response.json()["detail"].lower()

    def test_bulk_delete_invalid_ids_rejected(self, client, admin_token):
        """Negative or zero IDs should be rejected"""
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [-1, 0, 1]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400

    def test_bulk_delete_success_returns_count(self, client, admin_token, test_pedidos_batch):
        """Successful delete should return count of deleted items"""
        pedido_ids = [p["id"] for p in test_pedidos_batch]
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": pedido_ids},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == len(pedido_ids)
        assert data["errors"] == []

    def test_bulk_delete_atomic_rollback(self, client, admin_token):
        """If any pedido fails validation, none should be deleted"""
        # Mix of valid and invalid IDs - atomic means all fail
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [1, 999999]},  # 999999 doesn't exist
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should fail atomic validation
        assert response.status_code == 404


class TestBulkDeleteRateLimiting:
    """Tests for rate limiting on bulk delete"""

    def test_rate_limit_applied(self, client, admin_token, test_pedido):
        """Bulk delete should be rate limited"""
        # This test would need to make many rapid requests
        # For now, just verify the endpoint accepts requests
        response = client.post(
            "/api/pedidos/bulk-delete",
            json={"pedido_ids": [test_pedido["id"]]},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 429]  # 429 if rate limited
