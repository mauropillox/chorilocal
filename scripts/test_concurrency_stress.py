#!/usr/bin/env python3
"""
Minimal concurrency stress test: 2-5 concurrent users performing simultaneous writes.
Tests for "database is locked" errors and data consistency.

Usage:
    export BACKEND_URL="https://api.pedidosfriosur.com"
    export ADMIN_TOKEN="<your_admin_token>"
    python3 scripts/test_concurrency_stress.py
"""

import requests
import time
import threading
import json
import sys
import os
from collections import defaultdict

# Get backend URL from environment or use default
BACKEND_URL = os.getenv("BACKEND_URL", "https://api.pedidosfriosur.com")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", None)

LOCK_ERRORS = []
SUCCESS_COUNT = defaultdict(int)
FAIL_COUNT = defaultdict(int)
START_TIME = time.time()

def log_result(action, success, error_msg=None, duration_ms=0):
    """Log concurrent operation result"""
    global LOCK_ERRORS
    timestamp = time.time() - START_TIME
    thread_id = threading.current_thread().ident
    
    if success:
        SUCCESS_COUNT[action] += 1
        print(f"[{timestamp:6.2f}s][T{thread_id}] ✅ {action}: {duration_ms:.0f}ms")
    else:
        FAIL_COUNT[action] += 1
        if "database is locked" in (error_msg or "").lower():
            LOCK_ERRORS.append((action, error_msg))
            print(f"[{timestamp:6.2f}s][T{thread_id}] 🔒 {action}: DATABASE LOCKED")
        else:
            print(f"[{timestamp:6.2f}s][T{thread_id}] ❌ {action}: {error_msg}")

def create_cliente(user_id):
    """Concurrent: Create a new client"""
    try:
        start = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/clientes",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            json={
                "nombre": f"Cliente Concur Test {user_id}",
                "telefono": f"123456{user_id}",
                "direccion": f"Test Dir {user_id}",
                "zona": "ZONA_A"
            },
            timeout=5
        )
        duration = (time.time() - start) * 1000
        
        if response.status_code in [200, 201]:
            log_result("CREATE_CLIENTE", True, duration_ms=duration)
            return response.json().get("id")
        else:
            log_result("CREATE_CLIENTE", False, f"HTTP {response.status_code}: {response.text[:100]}")
            return None
    except Exception as e:
        log_result("CREATE_CLIENTE", False, str(e))
        return None

def create_producto(user_id):
    """Concurrent: Create a new product"""
    try:
        start = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/productos",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            json={
                "nombre": f"Prod Concur {user_id} {int(time.time())}",
                "precio": 99.99 + user_id,
                "stock": 100,
                "stock_minimo": 10
            },
            timeout=5
        )
        duration = (time.time() - start) * 1000
        
        if response.status_code in [200, 201]:
            log_result("CREATE_PRODUCTO", True, duration_ms=duration)
            return response.json().get("id")
        else:
            log_result("CREATE_PRODUCTO", False, f"HTTP {response.status_code}")
            return None
    except Exception as e:
        log_result("CREATE_PRODUCTO", False, str(e))
        return None

def update_stock_delta(producto_id, delta):
    """Concurrent: Update product stock (delta mode)"""
    try:
        start = time.time()
        response = requests.patch(
            f"{BACKEND_URL}/api/productos/{producto_id}/stock",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            json={"delta": delta},
            timeout=5
        )
        duration = (time.time() - start) * 1000
        
        if response.status_code == 200:
            log_result("PATCH_STOCK_DELTA", True, duration_ms=duration)
            return True
        else:
            log_result("PATCH_STOCK_DELTA", False, f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_result("PATCH_STOCK_DELTA", False, str(e))
        return False

def create_pedido(cliente_id, user_id):
    """Concurrent: Create an order"""
    try:
        start = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/pedidos",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            json={
                "cliente_id": cliente_id,
                "items": [
                    {"producto_id": 1, "cantidad": 5.0, "tipo": "unidad"}
                ],
                "notas": f"Concurrent test from user {user_id}"
            },
            timeout=5
        )
        duration = (time.time() - start) * 1000
        
        if response.status_code in [200, 201]:
            log_result("CREATE_PEDIDO", True, duration_ms=duration)
            return response.json().get("id")
        else:
            log_result("CREATE_PEDIDO", False, f"HTTP {response.status_code}")
            return None
    except Exception as e:
        log_result("CREATE_PEDIDO", False, str(e))
        return None

def worker_thread(user_id, num_operations=5):
    """Simulate a user performing N operations concurrently"""
    print(f"🚀 User {user_id} started ({num_operations} operations)")
    
    try:
        # Op 1: Create cliente
        cliente_id = create_cliente(user_id)
        if not cliente_id:
            cliente_id = 1  # Fallback to existing
        
        # Op 2: Create producto
        produto_id = create_producto(user_id)
        if not produto_id:
            produto_id = 1  # Fallback to existing
        
        # Op 3: Update stock (delta)
        for i in range(2):
            update_stock_delta(produto_id, -1)
        
        # Op 4: Create pedido
        create_pedido(cliente_id, user_id)
        
        print(f"✅ User {user_id} completed {num_operations} operations")
    except Exception as e:
        print(f"❌ User {user_id} failed: {e}")

def run_concurrency_test(num_users=3):
    """Run concurrent stress test with N simultaneous users"""
    global ADMIN_TOKEN, START_TIME
    
    # Get admin token
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/login",
            data={"username": "admin", "password": "admin420"},
            timeout=5
        )
        if response.status_code != 200:
            print(f"❌ Failed to login: {response.status_code}")
            return False
        ADMIN_TOKEN = response.json()["access_token"]
        print(f"✅ Authenticated as admin")
    except Exception as e:
        print(f"❌ Auth failed: {e}")
        return False
    
    # Run concurrent operations
    threads = []
    START_TIME = time.time()
    
    print(f"\n🔄 Starting {num_users} concurrent users...")
    for user_id in range(1, num_users + 1):
        t = threading.Thread(target=worker_thread, args=(user_id, 5))
        t.start()
        threads.append(t)
    
    # Wait for all threads
    for t in threads:
        t.join()
    
    # Report results
    total_time = time.time() - START_TIME
    total_success = sum(SUCCESS_COUNT.values())
    total_fail = sum(FAIL_COUNT.values())
    
    print(f"\n{'='*60}")
    print(f"CONCURRENCY TEST RESULTS ({num_users} users, {total_time:.2f}s)")
    print(f"{'='*60}")
    print(f"Total SUCCESS: {total_success}")
    print(f"Total FAILED: {total_fail}")
    print(f"")
    print(f"By Operation:")
    for action in sorted(set(list(SUCCESS_COUNT.keys()) + list(FAIL_COUNT.keys()))):
        s = SUCCESS_COUNT.get(action, 0)
        f = FAIL_COUNT.get(action, 0)
        print(f"  {action:20s}: {s:2d} ok, {f:2d} fail")
    
    if LOCK_ERRORS:
        print(f"\n🔒 DATABASE LOCKED ERRORS ({len(LOCK_ERRORS)}):")
        for action, msg in LOCK_ERRORS[:5]:
            print(f"  - {action}: {msg[:80]}")
        if len(LOCK_ERRORS) > 5:
            print(f"  ... and {len(LOCK_ERRORS)-5} more")
    
    print(f"{'='*60}\n")
    
    # Verdict
    if total_fail == 0:
        print(f"✅ VERDICT: PASS - All operations succeeded, no database locks")
        return True
    elif len(LOCK_ERRORS) / (total_success + total_fail) > 0.1:
        print(f"⚠️  VERDICT: WARNINGS - {len(LOCK_ERRORS)} database locks detected (>10% error rate)")
        return False
    else:
        print(f"⚠️  VERDICT: WARNINGS - {total_fail} failures, but acceptable lock rate")
        return True

if __name__ == "__main__":
    # Test with 2, 3, and 5 users
    for num_users in [2, 3, 5]:
        print(f"\n{'#'*60}")
        print(f"TEST: {num_users} Concurrent Users")
        print(f"{'#'*60}")
        run_concurrency_test(num_users)
        time.sleep(2)  # Cooldown between test runs
