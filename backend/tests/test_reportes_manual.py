#!/usr/bin/env python3
"""
Script manual para probar endpoints de reportes
NO PUSHEAR - solo para testing local
"""
import requests
import json
from datetime import datetime, timedelta

# Config
BASE_URL = "https://api.pedidosfriosur.com"
# BASE_URL = "http://localhost:8000/api"

def login():
    """Obtener token de autenticación"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin420"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

def test_reporte(token, endpoint, params=None):
    """Probar un endpoint de reporte"""
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/reportes/{endpoint}"
    
    print(f"\n{'='*60}")
    print(f"📊 Testing: {endpoint}")
    print(f"{'='*60}")
    
    response = requests.get(url, headers=headers, params=params or {})
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success - Status: {response.status_code}")
        print(f"📦 Response keys: {list(data.keys())}")
        
        # Print sample data for each key
        for key, value in data.items():
            if isinstance(value, list):
                print(f"\n  {key}: [{len(value)} items]")
                if len(value) > 0:
                    print(f"    Sample: {value[0]}")
            elif isinstance(value, dict):
                print(f"\n  {key}: {value}")
            else:
                print(f"\n  {key}: {value}")
        
        return data
    else:
        print(f"❌ Failed - Status: {response.status_code}")
        print(f"Error: {response.text}")
        return None

def main():
    print("🔐 Logging in...")
    token = login()
    
    if not token:
        print("❌ Cannot continue without token")
        return
    
    print(f"✅ Token obtained: {token[:20]}...")
    
    # Fechas para reportes con período
    desde = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    hasta = datetime.now().strftime("%Y-%m-%d")
    
    # Test all reportes
    reportes = {
        "ventas": {"desde": desde, "hasta": hasta},
        "inventario": {},
        "clientes": {},
        "productos": {"desde": desde, "hasta": hasta},
        "rendimiento": {},
        "comparativo": {}
    }
    
    results = {}
    for endpoint, params in reportes.items():
        results[endpoint] = test_reporte(token, endpoint, params)
    
    # Summary
    print(f"\n{'='*60}")
    print("📋 SUMMARY")
    print(f"{'='*60}")
    for endpoint, data in results.items():
        status = "✅" if data else "❌"
        print(f"{status} {endpoint}")
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    main()
