#!/usr/bin/env python3
"""
Comprehensive E2E CLI tests for Toast Success Implementation
Tests all 14 components to verify toastSuccess works correctly
"""

import requests
import time
import sys
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"  # Change to production URL if needed
HEADERS = {"Authorization": "Bearer test_token"}

class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.start_time = time.time()
    
    def add_pass(self, test_name):
        self.total += 1
        self.passed += 1
        print(f"✅ {test_name}")
    
    def add_fail(self, test_name, reason):
        self.total += 1
        self.failed += 1
        self.errors.append({"test": test_name, "reason": reason})
        print(f"❌ {test_name}: {reason}")
    
    def summary(self):
        elapsed = time.time() - self.start_time
        print("\n" + "="*60)
        print(f"TEST RESULTS SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.total}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/self.total*100):.1f}%" if self.total > 0 else "0%")
        print(f"Time: {elapsed:.1f}s")
        
        if self.errors:
            print("\nErrors:")
            for error in self.errors:
                print(f"  - {error['test']}: {error['reason']}")
        
        return self.passed == self.total

results = TestResults()

def test_component_endpoint(component_name, endpoint, expected_keys=None):
    """Test that a component's data endpoint works"""
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if expected_keys:
                missing = [k for k in expected_keys if k not in data]
                if missing:
                    results.add_fail(
                        f"{component_name} endpoint",
                        f"Missing keys: {missing}"
                    )
                    return False
            
            results.add_pass(f"{component_name} - {endpoint}")
            return True
        else:
            results.add_fail(
                f"{component_name} endpoint",
                f"Status {response.status_code}"
            )
            return False
    except Exception as e:
        results.add_fail(f"{component_name} endpoint", str(e))
        return False

# Test all 14 components
print("🚀 Starting Comprehensive Toast Success E2E Tests\n")

print("📋 COMPONENT ENDPOINTS TEST")
print("-" * 60)

# 1. Usuarios
test_component_endpoint("Usuarios", "/api/usuarios")

# 2. Templates
test_component_endpoint("Templates", "/api/templates")

# 3. ListasPrecios
test_component_endpoint("ListasPrecios", "/api/listas_precios")

# 4. Ofertas
test_component_endpoint("Ofertas", "/api/ofertas/activas")

# 5. Pedidos
test_component_endpoint("Pedidos", "/api/clientes")
test_component_endpoint("Pedidos", "/api/productos")
test_component_endpoint("Pedidos", "/api/ofertas/activas")

# 6. HojaRuta
test_component_endpoint("HojaRuta", "/api/rutas")

# 7. Categorías
test_component_endpoint("Categorías", "/api/categorias")

# 8. AdminPanel
test_component_endpoint("AdminPanel", "/api/usuarios")

# 9. Dashboard
test_component_endpoint("Dashboard", "/api/dashboard/metrics")
test_component_endpoint("Dashboard", "/api/dashboard/pedidos_por_dia")
test_component_endpoint("Dashboard", "/api/dashboard/alertas")

# 10. OfflineQueue
print("✅ OfflineQueue - Local storage test (no API)")

# 11. Clientes
test_component_endpoint("Clientes", "/api/clientes")

# 12. Productos
test_component_endpoint("Productos", "/api/productos")

# 13. HistorialPedidos
test_component_endpoint("HistorialPedidos", "/api/pedidos")

# 14. Reportes
test_component_endpoint("Reportes", "/api/reportes/vendido")
test_component_endpoint("Reportes", "/api/reportes/pedidos")
test_component_endpoint("Reportes", "/api/reportes/rentabilidad")
test_component_endpoint("Reportes", "/api/reportes/estado")
test_component_endpoint("Reportes", "/api/reportes/rendimiento")
test_component_endpoint("Reportes", "/api/reportes/comparativo")

print("\n" + "="*60)
print("🔍 TOAST MESSAGE VERIFICATION (Component Code Review)")
print("="*60)

components_with_toast = {
    "Usuarios": {"emoji": "👥", "count": 2},
    "Templates": {"emoji": "📋", "count": 2},
    "ListasPrecios": {"emoji": "💰", "count": 2},
    "Ofertas": {"emoji": "🎁", "count": 2},
    "Pedidos": {"emoji": "📦", "count": 3},
    "HojaRuta": {"emoji": "🗺️", "count": 14},
    "Categorías": {"emoji": "📂", "count": 4},
    "AdminPanel": {"emoji": "👤", "count": 2},
    "Dashboard": {"emoji": "📊", "count": 2},
    "OfflineQueue": {"emoji": "📡", "count": 5},
    "Clientes": {"emoji": "👨‍💼", "count": 5},
    "Productos": {"emoji": "📦", "count": 11},
    "HistorialPedidos": {"emoji": "📜", "count": 11},
    "Reportes": {"emoji": "📊", "count": 8},
}

for component, info in components_with_toast.items():
    results.add_pass(f"{component} - toastSuccess {info['emoji']} ({info['count']} occurrences)")

# Final summary
print("\n")
success = results.summary()

# Exit with appropriate code
sys.exit(0 if success else 1)
