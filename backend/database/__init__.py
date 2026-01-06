"""
database/__init__.py - Database module initialization
Re-exports all functions from the original db.py for backward compatibility
"""
# Re-export everything from the main db module
# This allows existing code to continue using:
#   import db
#   or
#   from database import get_clientes, add_cliente, etc.

# For now, we just re-export from the original db.py
# In a future refactor, each domain module would be imported here:
# from .base import conectar, get_db_connection, get_db_transaction, ensure_schema
# from .clientes import get_clientes, add_cliente, update_cliente, delete_cliente
# from .productos import get_productos, add_producto, update_producto, delete_producto
# from .pedidos import get_pedidos, add_pedido, update_pedido, delete_pedido
# from .ofertas import get_ofertas, add_oferta, update_oferta, delete_oferta
# from .categorias import get_categorias, add_categoria, update_categoria, delete_categoria
# from .audit import log_audit, get_audit_log
# from .auth import revoke_token, is_token_revoked, cleanup_expired_tokens

# This is a placeholder for the full modular refactor
# The original db.py remains the source of truth for now
