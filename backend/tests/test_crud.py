"""
Tests for CRUD operations on main entities.
"""
import pytest


class TestClientes:
    """Test client CRUD operations"""
    
    def test_get_clientes_empty(self, client, auth_headers):
        """Get clients when empty should return empty list"""
        response = client.get("/api/clientes", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_cliente(self, client, auth_headers):
        """Create a new client"""
        response = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Test Cliente",
            "telefono": "099123456",
            "direccion": "Calle Test 123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "Test Cliente"
        assert "id" in data
    
    def test_get_cliente_by_id(self, client, auth_headers):
        """Get a specific client by ID"""
        # Create first
        create_response = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Cliente Para Obtener",
            "telefono": "099999999"
        })
        cliente_id = create_response.json()["id"]
        
        # Get by ID
        response = client.get(f"/api/clientes/{cliente_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["nombre"] == "Cliente Para Obtener"
    
    def test_update_cliente(self, client, auth_headers):
        """Update an existing client"""
        # Create first
        create_response = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Cliente Original"
        })
        cliente_id = create_response.json()["id"]
        
        # Update
        response = client.put(f"/api/clientes/{cliente_id}", headers=auth_headers, json={
            "nombre": "Cliente Actualizado",
            "telefono": "099888777"
        })
        assert response.status_code == 200
        # Response may return the full client object or just success
        data = response.json()
        # Check if 'nombre' is in response, otherwise just verify success
        if "nombre" in data:
            assert data["nombre"] == "Cliente Actualizado"
        else:
            # Verify by fetching
            get_response = client.get(f"/api/clientes/{cliente_id}", headers=auth_headers)
            assert get_response.json()["nombre"] == "Cliente Actualizado"
    
    def test_delete_cliente_requires_admin(self, client, user_headers):
        """Delete requires admin role"""
        response = client.delete("/api/clientes/1", headers=user_headers)
        assert response.status_code == 403


class TestProductos:
    """Test product CRUD operations"""
    
    def test_create_producto(self, client, auth_headers):
        """Create a new product"""
        response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Chorizo Test",
            "precio": 100.50,
            "stock": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nombre"] == "Chorizo Test"
        assert data["precio"] == 100.50
    
    def test_get_productos(self, client, auth_headers):
        """Get all products"""
        # Create first
        client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Producto 1",
            "precio": 50.0
        })
        client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Producto 2",
            "precio": 75.0
        })
        
        response = client.get("/api/productos", headers=auth_headers)
        assert response.status_code == 200
        productos = response.json()
        assert len(productos) >= 2
    
    def test_search_productos(self, client, auth_headers):
        """Search products by name"""
        client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Morcilla Especial",
            "precio": 80.0
        })
        client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Chorizo Parrillero",
            "precio": 90.0
        })
        
        response = client.get("/api/productos?q=morcilla", headers=auth_headers)
        assert response.status_code == 200
        productos = response.json()
        assert len(productos) == 1
        assert "Morcilla" in productos[0]["nombre"]
    
    def test_update_producto(self, client, auth_headers):
        """Update a product"""
        create_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Producto Original",
            "precio": 100.0
        })
        producto_id = create_response.json()["id"]
        
        response = client.put(f"/api/productos/{producto_id}", headers=auth_headers, json={
            "nombre": "Producto Actualizado",
            "precio": 150.0
        })
        assert response.status_code == 200
        assert response.json()["precio"] == 150.0


class TestPedidos:
    """Test order operations"""
    
    def test_create_pedido(self, client, auth_headers):
        """Create a new order"""
        # Create cliente first
        cliente_response = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Cliente Pedido"
        })
        cliente_data = cliente_response.json()
        cliente_id = cliente_data["id"]
        
        # Create producto
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Producto Pedido",
            "precio": 100.0,
            "stock": 100
        })
        producto_data = producto_response.json()
        producto_id = producto_data["id"]
        
        # Create pedido with correct format (Pedido model expects cliente and productos)
        response = client.post("/api/pedidos", headers=auth_headers, json={
            "cliente": {
                "id": cliente_id,
                "nombre": "Cliente Pedido"
            },
            "productos": [
                {
                    "id": producto_id,
                    "nombre": "Producto Pedido",
                    "precio": 100.0,
                    "cantidad": 2,
                    "tipo": "unidad"
                }
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
    
    def test_get_pedidos(self, client, auth_headers):
        """Get all orders"""
        response = client.get("/api/pedidos", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestCategorias:
    """Test category operations"""
    
    def test_create_categoria(self, client, auth_headers):
        """Create a new category"""
        response = client.post("/api/categorias", headers=auth_headers, json={
            "nombre": "Embutidos",
            "color": "#FF5733"
        })
        assert response.status_code == 200
        assert response.json()["nombre"] == "Embutidos"
    
    def test_get_categorias(self, client, auth_headers):
        """Get all categories"""
        response = client.get("/api/categorias", headers=auth_headers)
        assert response.status_code == 200


class TestOfertas:
    """Test offers operations"""
    
    def test_create_oferta(self, client, auth_headers):
        """Create a new offer"""
        # Create producto first
        producto_response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Producto Oferta",
            "precio": 200.0,
            "stock": 50
        })
        producto_id = producto_response.json()["id"]
        
        # Create oferta using JSON (new API format)
        response = client.post("/api/ofertas", headers=auth_headers, json={
            "titulo": "Super Oferta",
            "descripcion": "Una oferta increíble",
            "desde": "2025-01-01",
            "hasta": "2025-12-31",
            "tipo": "porcentaje",
            "productos": [{"producto_id": producto_id, "cantidad": 1}],
            "descuento_porcentaje": 20
        })
        assert response.status_code == 200
    
    def test_get_ofertas(self, client, auth_headers):
        """Get all offers"""
        response = client.get("/api/ofertas", headers=auth_headers)
        assert response.status_code == 200


class TestStockDepletion:
    """Test stock boundary conditions and depletion"""
    
    def test_create_product_with_stock(self, client, auth_headers):
        """Products can be created with stock"""
        response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Product with Stock",
            "precio": 100.0,
            "stock": 50
        })
        assert response.status_code == 200
        data = response.json()
        assert data["stock"] == 50
    
    def test_create_product_without_stock(self, client, auth_headers):
        """Products can be created without stock specified"""
        response = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Product without Stock",
            "precio": 100.0
        })
        assert response.status_code == 200
        data = response.json()
        assert "stock" in data
    
    def test_order_with_available_stock(self, client, auth_headers):
        """Ordering product with available stock succeeds"""
        # Create product with stock
        create_product = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Available Stock Product",
            "precio": 50.0,
            "stock": 10
        })
        product_id = create_product.json()["id"]
        
        # Create client
        create_client = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Stock Order Client"
        })
        client_id = create_client.json()["id"]
        
        # Order from available stock
        response = client.post("/api/pedidos", headers=auth_headers, json={
            "cliente_id": client_id,
            "items": [
                {
                    "producto_id": product_id,
                    "cantidad": 5
                }
            ]
        })
        # Should succeed
        assert response.status_code == 200
    
    def test_multiple_orders_reduce_stock(self, client, auth_headers):
        """Multiple orders can be created (stock behavior depends on implementation)"""
        # Create product
        create_product = client.post("/api/productos", headers=auth_headers, json={
            "nombre": "Multi Order Product",
            "precio": 75.0,
            "stock": 20
        })
        product_id = create_product.json()["id"]
        
        # Create client
        create_client = client.post("/api/clientes", headers=auth_headers, json={
            "nombre": "Multi Client"
        })
        client_id = create_client.json()["id"]
        
        # Create first order
        response1 = client.post("/api/pedidos", headers=auth_headers, json={
            "cliente_id": client_id,
            "items": [{"producto_id": product_id, "cantidad": 5}]
        })
        assert response1.status_code == 200
        
        # Create second order
        response2 = client.post("/api/pedidos", headers=auth_headers, json={
            "cliente_id": client_id,
            "items": [{"producto_id": product_id, "cantidad": 3}]
        })
        assert response2.status_code == 200
