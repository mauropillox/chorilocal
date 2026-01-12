#!/usr/bin/env python3
"""
Comprehensive CLI test for all reportes endpoints against production.
Tests API responses AND simulates CSV export logic.
"""
import requests
import json
from datetime import datetime

# Production API
BASE_URL = "https://api.pedidosfriosur.com"
USERNAME = "admin"
PASSWORD = "admin420"

def login():
    """Login and get JWT token"""
    print("🔐 Logging in...")
    response = requests.post(
        f"{BASE_URL}/api/login",
        data={"username": USERNAME, "password": PASSWORD}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✅ Login successful")
        return token
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_endpoint(token, endpoint, params=None):
    """Test a single endpoint"""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/api/reportes/{endpoint}"
    
    print(f"\n{'='*70}")
    print(f"📊 Testing: /api/reportes/{endpoint}")
    print(f"{'='*70}")
    
    response = requests.get(url, headers=headers, params=params or {})
    
    if response.status_code != 200:
        print(f"❌ FAILED: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        return None
    
    data = response.json()
    print(f"✅ SUCCESS: Status 200")
    return data

def simulate_csv_export(data, columns):
    """Simulate CSV export logic"""
    print(f"\n📄 Simulating CSV Export...")
    print(f"Columns: {list(columns.keys())}")
    
    # Create header row
    headers = list(columns.values())
    csv_line = ",".join(headers)
    print(f"Header: {csv_line}")
    
    # If data is a dict with a 'data' key or similar, extract array
    if isinstance(data, dict):
        # Find the array in the dict
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 0:
                data = value
                break
    
    if isinstance(data, list) and len(data) > 0:
        # Take first row as sample
        first_row = data[0]
        values = []
        for col_key in columns.keys():
            val = first_row.get(col_key, "N/A")
            # Simulate number formatting
            if isinstance(val, (int, float)):
                val = f"{float(val):.2f}"
            values.append(str(val))
        
        csv_line = ",".join(values)
        print(f"Sample Row: {csv_line}")
        print(f"✅ CSV Export OK - {len(data)} rows")
        return True
    else:
        print(f"⚠️ No array data found for CSV export")
        return False

def main():
    token = login()
    if not token:
        return
    
    print(f"\n{'#'*70}")
    print(f"# TESTING ALL REPORTES ENDPOINTS")
    print(f"{'#'*70}")
    
    # 1. VENTAS
    print(f"\n\n🔵 1. VENTAS REPORT")
    ventas = test_endpoint(token, "ventas", {
        "desde": "2025-01-01",
        "hasta": "2026-01-10"
    })
    if ventas:
        print(f"\nKeys: {list(ventas.keys())}")
        if 'top_productos' in ventas:
            print(f"top_productos count: {len(ventas['top_productos'])}")
            simulate_csv_export(ventas['top_productos'], {
                'nombre': 'Producto',
                'cantidad': 'Cantidad Vendida',
                'total': 'Total Vendido ($)'
            })
    
    # 2. INVENTARIO
    print(f"\n\n🔵 2. INVENTARIO REPORT")
    inventario = test_endpoint(token, "inventario")
    if inventario:
        print(f"\nKeys: {list(inventario.keys())}")
        if 'productos' in inventario:
            print(f"productos count: {len(inventario['productos'])}")
            simulate_csv_export(inventario['productos'], {
                'nombre': 'Producto',
                'stock': 'Stock Actual',
                'stock_minimo': 'Stock Mínimo',
                'precio': 'Precio ($)',
            })
    
    # 3. CLIENTES
    print(f"\n\n🔵 3. CLIENTES REPORT")
    clientes = test_endpoint(token, "clientes")
    if clientes:
        print(f"\nKeys: {list(clientes.keys())}")
        if 'clientes' in clientes:
            print(f"clientes count: {len(clientes['clientes'])}")
            simulate_csv_export(clientes['clientes'], {
                'nombre': 'Cliente',
                'telefono': 'Teléfono',
                'direccion': 'Dirección',
                'total_pedidos': 'Total Pedidos',
                'total_gastado': 'Total Gastado ($)',
                'ultimo_pedido': 'Último Pedido'
            })
    
    # 4. PRODUCTOS
    print(f"\n\n🔵 4. PRODUCTOS REPORT")
    productos = test_endpoint(token, "productos")
    if productos:
        print(f"\nKeys: {list(productos.keys())}")
        if 'mas_vendidos' in productos:
            print(f"mas_vendidos count: {len(productos['mas_vendidos'])}")
        if 'sin_ventas' in productos:
            print(f"sin_ventas count: {len(productos['sin_ventas'])}")
    
    # 5. RENDIMIENTO
    print(f"\n\n🔵 5. RENDIMIENTO REPORT")
    rendimiento = test_endpoint(token, "rendimiento")
    if rendimiento:
        print(f"\nKeys: {list(rendimiento.keys())}")
        if 'metricas' in rendimiento:
            print(f"metricas: {json.dumps(rendimiento['metricas'], indent=2)}")
        if 'usuarios_activos' in rendimiento:
            print(f"usuarios_activos: {rendimiento['usuarios_activos']}")
    
    # 6. COMPARATIVO
    print(f"\n\n🔵 6. COMPARATIVO REPORT")
    comparativo = test_endpoint(token, "comparativo")
    if comparativo:
        print(f"\nKeys: {list(comparativo.keys())}")
        if 'mensual' in comparativo:
            print(f"mensual keys: {list(comparativo['mensual'].keys())}")
        if 'ultimos_7_dias' in comparativo:
            print(f"ultimos_7_dias: {comparativo['ultimos_7_dias']}")
        if 'ultimos_6_meses' in comparativo:
            print(f"ultimos_6_meses count: {len(comparativo['ultimos_6_meses'])}")
    
    print(f"\n\n{'#'*70}")
    print(f"# ✅ ALL TESTS COMPLETED")
    print(f"{'#'*70}\n")

if __name__ == "__main__":
    main()
