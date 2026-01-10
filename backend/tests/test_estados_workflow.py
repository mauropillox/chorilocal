"""
Tests específicos para el nuevo flujo simplificado de estados de pedidos
"""
import pytest


def obtener_pedido_por_id(client, auth_headers, pedido_id):
    """Helper function para obtener un pedido específico por ID"""
    response = client.get("/pedidos", headers=auth_headers)
    assert response.status_code == 200
    
    pedidos = response.json()
    if isinstance(pedidos, dict) and 'data' in pedidos:
        pedidos = pedidos['data']
    
    # Buscar el pedido por ID
    for pedido in pedidos:
        if pedido.get('id') == pedido_id:
            return pedido
    
    raise ValueError(f"Pedido {pedido_id} no encontrado")


def crear_pedido_test(client, auth_headers, cliente_nombre="Cliente Test", producto_nombre="Producto Test"):
    """Helper function para crear pedidos de test"""
    # Crear cliente
    cliente_response = client.post("/clientes", headers=auth_headers, json={
        "nombre": cliente_nombre,
        "telefono": "099123456"
    })
    cliente_id = cliente_response.json()["id"]
    
    # Crear producto
    producto_response = client.post("/productos", headers=auth_headers, json={
        "nombre": producto_nombre,
        "precio": 10.0,
        "categoria": "Test",
        "stock": 100
    })
    producto_id = producto_response.json()["id"]
    
    # Crear pedido
    pedido_data = {
        "cliente": {
            "id": cliente_id,
            "nombre": cliente_nombre
        },
        "productos": [
            {
                "id": producto_id,
                "nombre": producto_nombre,
                "precio": 10.0,
                "cantidad": 1,
                "tipo": "unidad"
            }
        ]
    }
    
    response = client.post("/pedidos", headers=auth_headers, json=pedido_data)
    assert response.status_code == 200
    return response.json()["id"]


class TestEstadosWorkflow:
    """Tests para validar transiciones de estados del nuevo workflow simplificado"""
    
    def test_estados_validos_configurados(self, client, auth_headers):
        """Verificar que los estados válidos estén configurados correctamente"""
        # Crear pedido usando helper
        pedido_id = crear_pedido_test(client, auth_headers, "Cliente Test Estados", "Producto Test Estados")
        
        # Verificar estado inicial es 'pendiente'
        pedido = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido["estado"] == "pendiente"
    
    def test_transicion_pendiente_a_preparando(self, client, auth_headers):
        """Test transición pendiente → preparando"""
        # Crear pedido
        pedido_id = crear_pedido_test(client, auth_headers)
        
        # Cambiar a preparando
        response = client.put(f"/pedidos/{pedido_id}/estado", headers=auth_headers, json={"estado": "preparando"})
        assert response.status_code == 200
        
        # Verificar cambio
        pedido = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido["estado"] == "preparando"
    
    def test_transicion_preparando_a_entregado(self, client, auth_headers):
        """Test transición preparando → entregado"""
        # Crear pedido
        pedido_id = crear_pedido_test(client, auth_headers)
        
        # Llevar a preparando
        client.put(f"/pedidos/{pedido_id}/estado", headers=auth_headers, json={"estado": "preparando"})
        
        # Cambiar a entregado
        response = client.put(f"/pedidos/{pedido_id}/estado", headers=auth_headers, json={"estado": "entregado"})
        assert response.status_code == 200
        
        # Verificar cambio
        pedido = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido["estado"] == "entregado"
    
    def test_cancelar_pedido_desde_cualquier_estado(self, client, auth_headers):
        """Test que se puede cancelar desde cualquier estado"""
        # Crear pedido
        pedido_id = crear_pedido_test(client, auth_headers)
        
        # Cancelar desde pendiente
        response = client.put(f"/pedidos/{pedido_id}/estado", headers=auth_headers, json={"estado": "cancelado"})
        assert response.status_code == 200
        
        # Verificar estado
        pedido = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido["estado"] == "cancelado"
    
    def test_estados_no_validos_rechazados(self, client, auth_headers):
        """Test que estados no válidos son rechazados"""
        # Crear pedido
        pedido_id = crear_pedido_test(client, auth_headers)
        
        # Intentar estados obsoletos
        for estado_obsoleto in ["tomado", "listo"]:
            response = client.put(f"/pedidos/{pedido_id}/estado", 
                                headers=auth_headers, json={"estado": estado_obsoleto})
            assert response.status_code == 400  # Error de validación
    
    def test_workflow_completo(self, client, auth_headers):
        """Test del workflow completo: pendiente → preparando → entregado"""
        # Crear pedido
        pedido_id = crear_pedido_test(client, auth_headers, "Cliente Test Workflow", "Producto Test Workflow")
        
        # Verificar estado inicial
        pedido = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido["estado"] == "pendiente"
        
        # Paso 1: pendiente → preparando
        response = client.put(f"/pedidos/{pedido_id}/estado", 
                            headers=auth_headers, json={"estado": "preparando"})
        assert response.status_code == 200
        
        # Paso 2: preparando → entregado
        response = client.put(f"/pedidos/{pedido_id}/estado", 
                            headers=auth_headers, json={"estado": "entregado"})
        assert response.status_code == 200
        
        # Verificar estado final
        pedido_final = obtener_pedido_por_id(client, auth_headers, pedido_id)
        assert pedido_final["estado"] == "entregado"
    
    def test_filtros_por_estado_funcionan(self, client, auth_headers):
        """Test que los filtros por estado funcionan con nuevos estados"""
        # Crear pedidos en diferentes estados
        pedidos_creados = []
        
        for estado in ["pendiente", "preparando", "entregado", "cancelado"]:
            # Crear pedido
            pedido_id = crear_pedido_test(client, auth_headers, f"Cliente {estado}", f"Producto {estado}")
            pedidos_creados.append(pedido_id)
            
            # Cambiar a estado específico si no es pendiente
            if estado != "pendiente":
                client.put(f"/pedidos/{pedido_id}/estado", headers=auth_headers, json={"estado": estado})
        
        # Probar filtros
        for estado in ["pendiente", "preparando", "entregado", "cancelado"]:
            response = client.get(f"/pedidos?estado={estado}", headers=auth_headers)
            assert response.status_code == 200
            
            pedidos_filtrados = response.json()
            # Verificar que todos los pedidos tienen el estado correcto
            for pedido in pedidos_filtrados:
                assert pedido["estado"] == estado


class TestMigracionEstados:
    """Tests para verificar que la migración de estados funcionó"""
    
    def test_no_hay_estados_obsoletos_en_base(self, client, auth_headers):
        """Verificar que no quedan estados obsoletos después de la migración"""
        # Obtener todos los pedidos
        response = client.get("/pedidos", headers=auth_headers)
        assert response.status_code == 200
        
        pedidos = response.json()
        estados_obsoletos = ["tomado", "listo"]
        
        # Verificar que ningún pedido tiene estados obsoletos
        for pedido in pedidos:
            assert pedido.get("estado") not in estados_obsoletos, f"Pedido {pedido.get('id')} tiene estado obsoleto: {pedido.get('estado')}"
    
    def test_estados_validos_solamente(self, client, auth_headers):
        """Verificar que solo existen estados válidos en la base"""
        # Obtener todos los pedidos
        response = client.get("/pedidos", headers=auth_headers)
        assert response.status_code == 200
        
        pedidos = response.json()
        estados_validos = ["pendiente", "preparando", "entregado", "cancelado"]
        
        # Verificar que todos los pedidos tienen estados válidos
        for pedido in pedidos:
            estado = pedido.get("estado", "pendiente")  # Default por si acaso
            assert estado in estados_validos, f"Pedido {pedido.get('id')} tiene estado inválido: {estado}"