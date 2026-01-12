"""
Pytest configuration and fixtures for backend tests.
"""
import os
import sys
import pytest
import tempfile

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment before importing app modules
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"

# Create temp directories for uploads/media to avoid permission errors
import tempfile
_temp_upload_dir = tempfile.mkdtemp(prefix="test_uploads_")
os.environ["UPLOAD_DIR"] = _temp_upload_dir
os.environ["MEDIA_DIR"] = _temp_upload_dir

@pytest.fixture(scope="function")
def temp_db():
    """Create a temporary database for each test"""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = f.name
    
    # Set the DB path before importing db module
    os.environ["DB_PATH"] = temp_path
    
    # Import db and initialize schema
    import db
    # Force reconnection with new path
    db.DB_PATH = temp_path
    db.ensure_schema()
    
    yield temp_path
    
    # Cleanup
    try:
        os.unlink(temp_path)
    except Exception:
        pass

@pytest.fixture(scope="function")
def client(temp_db):
    """Create a test client for the FastAPI app"""
    from fastapi.testclient import TestClient
    import main
    
    # Reset limiter for tests
    main.limiter.enabled = False
    
    return TestClient(main.app)

@pytest.fixture
def admin_token(client):
    """Get an admin user token for authenticated requests"""
    import db
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Create admin user directly in DB
    con = db.conectar()
    cur = con.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO usuarios (username, password_hash, rol, activo)
        VALUES (?, ?, ?, ?)
    """, ("testadmin", pwd_context.hash("testpass123"), "admin", 1))
    con.commit()
    con.close()
    
    # Login to get token
    response = client.post("/login", data={
        "username": "testadmin",
        "password": "testpass123"
    })
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture
def user_token(client):
    """Get a regular user token for authenticated requests"""
    import db
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Create regular user directly in DB
    con = db.conectar()
    cur = con.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO usuarios (username, password_hash, rol, activo)
        VALUES (?, ?, ?, ?)
    """, ("testuser", pwd_context.hash("testpass123"), "user", 1))
    con.commit()
    con.close()
    
    # Login to get token
    response = client.post("/login", data={
        "username": "testuser",
        "password": "testpass123"
    })
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture
def auth_headers(admin_token):
    """Return authorization headers for admin user with X-Confirm-Delete for DELETE operations"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Confirm-Delete": "true"
    }

@pytest.fixture
def user_headers(user_token):
    """Return authorization headers for regular user with X-Confirm-Delete"""
    return {
        "Authorization": f"Bearer {user_token}",
        "X-Confirm-Delete": "true"
    }

@pytest.fixture
def vendedor_token(client):
    """Get a vendedor (non-admin) user token for authenticated requests"""
    import db
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Create vendedor user directly in DB
    con = db.conectar()
    cur = con.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO usuarios (username, password_hash, rol, activo)
        VALUES (?, ?, ?, ?)
    """, ("testvendedor", pwd_context.hash("testpass123"), "user", 1))
    con.commit()
    con.close()
    
    # Login to get token
    response = client.post("/login", data={
        "username": "testvendedor",
        "password": "testpass123"
    })
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture
def test_pedido(client, auth_headers):
    """Create a test pedido for use in tests"""
    import db
    
    # Create cliente and producto directly in DB
    con = db.conectar()
    cur = con.cursor()
    
    # Create test cliente
    cur.execute("INSERT INTO clientes (nombre) VALUES (?)", ("Cliente Test Pedido",))
    cliente_id = cur.lastrowid
    
    # Create test producto
    cur.execute("""
        INSERT INTO productos (nombre, precio, stock) 
        VALUES (?, ?, ?)
    """, ("Producto Test", 100.0, 100))
    producto_id = cur.lastrowid
    
    # Create test pedido
    cur.execute("""
        INSERT INTO pedidos (cliente_id, estado, creado_por)
        VALUES (?, ?, ?)
    """, (cliente_id, "pendiente", "testadmin"))
    pedido_id = cur.lastrowid
    
    # Add item to pedido
    cur.execute("""
        INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
    """, (pedido_id, producto_id, 1, 100.0))
    
    con.commit()
    con.close()
    
    return {"id": pedido_id, "cliente_id": cliente_id, "producto_id": producto_id}

@pytest.fixture
def test_pedidos_batch(client, auth_headers):
    """Create multiple test pedidos for use in tests"""
    import db
    
    con = db.conectar()
    cur = con.cursor()
    pedidos = []
    
    for i in range(3):
        # Create test cliente
        cur.execute("INSERT INTO clientes (nombre) VALUES (?)", (f"Cliente Batch {i}",))
        cliente_id = cur.lastrowid
        
        # Create test producto
        cur.execute("""
            INSERT INTO productos (nombre, precio, stock)
            VALUES (?, ?, ?)
        """, (f"Producto Batch {i}", 100.0 + i, 100))
        producto_id = cur.lastrowid
        
        # Create test pedido
        cur.execute("""
            INSERT INTO pedidos (cliente_id, estado, creado_por)
            VALUES (?, ?, ?)
        """, (cliente_id, "pendiente", "testadmin"))
        pedido_id = cur.lastrowid
        
        # Add item to pedido
        cur.execute("""
            INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
            VALUES (?, ?, ?, ?)
        """, (pedido_id, producto_id, 1, 100.0 + i))
        
        pedidos.append({"id": pedido_id, "cliente_id": cliente_id, "producto_id": producto_id})
    
    con.commit()
    con.close()
    
    return pedidos
