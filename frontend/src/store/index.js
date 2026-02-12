/**
 * Chorizaurio - Centralized State Management with Zustand
 * 
 * This store manages all application state in a centralized location,
 * replacing fragmented useState hooks across components.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL;

// Helper function for authenticated fetch
const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token expired or invalid - trigger logout
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Session expired');
    }

    return response;
};

// Create the main store with immer for immutable updates
export const useAppStore = create(
    immer(
        persist(
            (set, get) => ({
                // ==================== AUTH STATE ====================
                auth: {
                    user: null,
                    token: null,
                    isLoading: false,
                    error: null,
                },

                // Auth actions
                login: async (username, password) => {
                    set(state => { state.auth.isLoading = true; state.auth.error = null; });

                    try {
                        const params = new URLSearchParams();
                        params.append('username', username);
                        params.append('password', password);

                        const res = await fetch(`${API_URL}/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: params,
                        });

                        if (!res.ok) {
                            const errorData = await res.json().catch(() => ({}));
                            throw new Error(errorData.error || errorData.detail || 'Credenciales inválidas');
                        }

                        const data = await res.json();
                        const token = data.access_token;
                        const payload = JSON.parse(atob(token.split('.')[1]));

                        localStorage.setItem('token', token);

                        set(state => {
                            state.auth.user = {
                                id: payload.sub,
                                username: data.username,
                                rol: payload.rol,
                                exp: payload.exp,
                            };
                            state.auth.token = token;
                            state.auth.isLoading = false;
                        });

                        // Notify main.jsx to prefetch offline data
                        try { window.dispatchEvent(new Event('auth:login-success')); } catch (e) { }

                        return data;
                    } catch (error) {
                        set(state => {
                            state.auth.error = error.message;
                            state.auth.isLoading = false;
                        });
                        throw error;
                    }
                },

                logout: async () => {
                    const token = localStorage.getItem('token');

                    // Call backend logout endpoint
                    if (token) {
                        try {
                            await fetch(`${API_URL}/logout`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` },
                            });
                        } catch (e) {
                            logger.warn('Logout request failed:', e);
                        }
                    }

                    localStorage.removeItem('token');

                    set(state => {
                        state.auth.user = null;
                        state.auth.token = null;
                        state.auth.error = null;
                    });
                },

                initAuth: () => {
                    const token = localStorage.getItem('token');
                    if (token) {
                        try {
                            const payload = JSON.parse(atob(token.split('.')[1]));

                            // Check if token is expired
                            if (payload.exp * 1000 < Date.now()) {
                                localStorage.removeItem('token');
                                return;
                            }

                            set(state => {
                                state.auth.user = {
                                    id: payload.sub,
                                    username: payload.sub,
                                    rol: payload.rol,
                                    exp: payload.exp,
                                };
                                state.auth.token = token;
                            });
                        } catch {
                            localStorage.removeItem('token');
                        }
                    }
                },

                // ==================== ENTITIES STATE ====================
                entities: {
                    clientes: [],
                    productos: [],
                    pedidos: [],
                    categorias: [],
                    ofertas: [],
                    productImages: {}, // Global cache for product images
                    loadingImageIds: {}, // Track IDs currently being loaded (plain obj for Immer compat)
                    isLoading: {
                        clientes: false,
                        productos: false,
                        pedidos: false,
                        categorias: false,
                        ofertas: false,
                    },
                    errors: {
                        clientes: null,
                        productos: null,
                        pedidos: null,
                        categorias: null,
                        ofertas: null,
                    },
                    lastFetched: {
                        clientes: null,
                        productos: null,
                        pedidos: null,
                        categorias: null,
                        ofertas: null,
                    },
                },

                // Entity actions - Clientes
                fetchClientes: async (force = false) => {
                    const { entities } = get();
                    const cacheTime = 5 * 60 * 1000; // 5 minutes

                    // Return cached if not forced and cache is valid
                    if (!force && entities.lastFetched.clientes &&
                        Date.now() - entities.lastFetched.clientes < cacheTime) {
                        return entities.clientes;
                    }

                    set(state => { state.entities.isLoading.clientes = true; });

                    try {
                        const res = await authFetch(`${API_URL}/clientes/`);
                        if (!res.ok) throw new Error('Failed to fetch clientes');
                        const data = await res.json();

                        set(state => {
                            state.entities.clientes = data;
                            state.entities.isLoading.clientes = false;
                            state.entities.lastFetched.clientes = Date.now();
                            state.entities.errors.clientes = null;
                        });

                        return data;
                    } catch (error) {
                        set(state => {
                            state.entities.isLoading.clientes = false;
                            state.entities.errors.clientes = error.message;
                        });
                        throw error;
                    }
                },

                // Entity actions - Productos
                fetchProductos: async (force = false) => {
                    const { entities } = get();
                    const cacheTime = 5 * 60 * 1000;

                    if (!force && entities.lastFetched.productos &&
                        Date.now() - entities.lastFetched.productos < cacheTime) {
                        return entities.productos;
                    }

                    set(state => { state.entities.isLoading.productos = true; });

                    try {
                        const res = await authFetch(`${API_URL}/productos/`);
                        if (!res.ok) throw new Error('Failed to fetch productos');
                        const data = await res.json();

                        set(state => {
                            state.entities.productos = data;
                            state.entities.isLoading.productos = false;
                            state.entities.lastFetched.productos = Date.now();
                            state.entities.errors.productos = null;
                        });

                        return data;
                    } catch (error) {
                        set(state => {
                            state.entities.isLoading.productos = false;
                            state.entities.errors.productos = error.message;
                        });
                        throw error;
                    }
                },

                // Entity actions - Pedidos
                fetchPedidos: async (force = false) => {
                    const { entities } = get();
                    const cacheTime = 2 * 60 * 1000; // 2 minutes for pedidos (more dynamic)

                    if (!force && entities.lastFetched.pedidos &&
                        Date.now() - entities.lastFetched.pedidos < cacheTime) {
                        return entities.pedidos;
                    }

                    set(state => { state.entities.isLoading.pedidos = true; });

                    try {
                        const res = await authFetch(`${API_URL}/pedidos/`);
                        if (!res.ok) throw new Error('Failed to fetch pedidos');
                        const data = await res.json();

                        set(state => {
                            state.entities.pedidos = data;
                            state.entities.isLoading.pedidos = false;
                            state.entities.lastFetched.pedidos = Date.now();
                            state.entities.errors.pedidos = null;
                        });

                        return data;
                    } catch (error) {
                        set(state => {
                            state.entities.isLoading.pedidos = false;
                            state.entities.errors.pedidos = error.message;
                        });
                        throw error;
                    }
                },

                // Entity actions - Categorias
                fetchCategorias: async (force = false) => {
                    const { entities } = get();
                    const cacheTime = 10 * 60 * 1000; // 10 minutes for categorias (static)

                    if (!force && entities.lastFetched.categorias &&
                        Date.now() - entities.lastFetched.categorias < cacheTime) {
                        return entities.categorias;
                    }

                    set(state => { state.entities.isLoading.categorias = true; });

                    try {
                        const res = await authFetch(`${API_URL}/categorias/`);
                        if (!res.ok) throw new Error('Failed to fetch categorias');
                        const data = await res.json();

                        set(state => {
                            state.entities.categorias = data;
                            state.entities.isLoading.categorias = false;
                            state.entities.lastFetched.categorias = Date.now();
                            state.entities.errors.categorias = null;
                        });

                        return data;
                    } catch (error) {
                        set(state => {
                            state.entities.isLoading.categorias = false;
                            state.entities.errors.categorias = error.message;
                        });
                        throw error;
                    }
                },

                // Entity actions - Ofertas
                fetchOfertas: async (force = false) => {
                    const { entities } = get();
                    const cacheTime = 5 * 60 * 1000;

                    if (!force && entities.lastFetched.ofertas &&
                        Date.now() - entities.lastFetched.ofertas < cacheTime) {
                        return entities.ofertas;
                    }

                    set(state => { state.entities.isLoading.ofertas = true; });

                    try {
                        const res = await authFetch(`${API_URL}/ofertas/`);
                        if (!res.ok) throw new Error('Failed to fetch ofertas');
                        const data = await res.json();

                        set(state => {
                            state.entities.ofertas = data;
                            state.entities.isLoading.ofertas = false;
                            state.entities.lastFetched.ofertas = Date.now();
                            state.entities.errors.ofertas = null;
                        });

                        return data;
                    } catch (error) {
                        set(state => {
                            state.entities.isLoading.ofertas = false;
                            state.entities.errors.ofertas = error.message;
                        });
                        throw error;
                    }
                },

                // Clear entity cache
                clearEntityCache: (entityName = null) => {
                    set(state => {
                        if (entityName) {
                            state.entities.lastFetched[entityName] = null;
                        } else {
                            // Clear all
                            Object.keys(state.entities.lastFetched).forEach(key => {
                                state.entities.lastFetched[key] = null;
                            });
                        }
                    });
                },

                // Direct setters for React Query integration
                setProductos: (productos) => {
                    set(state => {
                        state.entities.productos = productos;
                        state.entities.lastFetched.productos = Date.now();
                    });
                },

                // Product images cache actions
                setProductImages: (images) => {
                    set(state => {
                        state.entities.productImages = { ...state.entities.productImages, ...images };
                    });
                },

                markImagesLoading: (ids) => {
                    set(state => {
                        ids.forEach(id => { state.entities.loadingImageIds[id] = true; });
                    });
                },

                setClientes: (clientes) => {
                    set(state => {
                        state.entities.clientes = clientes;
                        state.entities.lastFetched.clientes = Date.now();
                    });
                },

                setPedidos: (pedidos) => {
                    set(state => {
                        state.entities.pedidos = pedidos;
                        state.entities.lastFetched.pedidos = Date.now();
                    });
                },

                setCategorias: (categorias) => {
                    set(state => {
                        state.entities.categorias = categorias;
                        state.entities.lastFetched.categorias = Date.now();
                    });
                },

                setOfertas: (ofertas) => {
                    set(state => {
                        state.entities.ofertas = ofertas;
                        state.entities.lastFetched.ofertas = Date.now();
                    });
                },

                // ==================== UI STATE ====================
                ui: {
                    sidebarOpen: true,
                    theme: 'light',
                    toasts: [],
                    confirmDialog: null,
                },

                // UI actions
                toggleSidebar: () => {
                    set(state => { state.ui.sidebarOpen = !state.ui.sidebarOpen; });
                },

                setTheme: (theme) => {
                    set(state => { state.ui.theme = theme; });
                },

                addToast: (toast) => {
                    const id = Date.now();
                    set(state => {
                        state.ui.toasts.push({ id, ...toast });
                    });

                    // Auto-remove after duration
                    setTimeout(() => {
                        set(state => {
                            state.ui.toasts = state.ui.toasts.filter(t => t.id !== id);
                        });
                    }, toast.duration || 5000);

                    return id;
                },

                removeToast: (id) => {
                    set(state => {
                        state.ui.toasts = state.ui.toasts.filter(t => t.id !== id);
                    });
                },

                showConfirmDialog: (config) => {
                    set(state => { state.ui.confirmDialog = config; });
                },

                hideConfirmDialog: () => {
                    set(state => { state.ui.confirmDialog = null; });
                },

                // ==================== RESET STORE ====================
                resetStore: () => {
                    set(state => {
                        state.auth = { user: null, token: null, isLoading: false, error: null };
                        state.entities = {
                            clientes: [],
                            productos: [],
                            pedidos: [],
                            categorias: [],
                            ofertas: [],
                            isLoading: {
                                clientes: false,
                                productos: false,
                                pedidos: false,
                                categorias: false,
                                ofertas: false,
                            },
                            errors: {
                                clientes: null,
                                productos: null,
                                pedidos: null,
                                categorias: null,
                                ofertas: null,
                            },
                            lastFetched: {
                                clientes: null,
                                productos: null,
                                pedidos: null,
                                categorias: null,
                                ofertas: null,
                            },
                        };
                        state.ui.toasts = [];
                        state.ui.confirmDialog = null;
                    });
                },
            }),
            {
                name: 'chorizaurio-store',
                storage: createJSONStorage(() => localStorage),
                // Persist UI state + entity data for offline resilience
                // Excludes: productImages (base64 blobs), loadingImageIds, isLoading, errors
                partialize: (state) => ({
                    ui: {
                        sidebarOpen: state.ui.sidebarOpen,
                        theme: state.ui.theme,
                    },
                    entities: {
                        clientes: state.entities.clientes,
                        productos: state.entities.productos,
                        pedidos: state.entities.pedidos,
                        categorias: state.entities.categorias,
                        ofertas: state.entities.ofertas,
                        lastFetched: state.entities.lastFetched,
                    },
                }),
            }
        )
    )
);

// Selector hooks for convenience
export const useAuth = () => useAppStore(state => state.auth);
export const useAuthActions = () => useAppStore(state => ({
    login: state.login,
    logout: state.logout,
    initAuth: state.initAuth,
}));

export const useClientes = () => useAppStore(state => state.entities.clientes);
export const useProductos = () => useAppStore(state => state.entities.productos);
export const usePedidos = () => useAppStore(state => state.entities.pedidos);
export const useCategorias = () => useAppStore(state => state.entities.categorias);
export const useOfertas = () => useAppStore(state => state.entities.ofertas);

export const useEntityActions = () => useAppStore(state => ({
    fetchClientes: state.fetchClientes,
    fetchProductos: state.fetchProductos,
    fetchPedidos: state.fetchPedidos,
    fetchCategorias: state.fetchCategorias,
    fetchOfertas: state.fetchOfertas,
    clearEntityCache: state.clearEntityCache,
}));

export const useUI = () => useAppStore(state => state.ui);
export const useUIActions = () => useAppStore(state => ({
    toggleSidebar: state.toggleSidebar,
    setTheme: state.setTheme,
    addToast: state.addToast,
    removeToast: state.removeToast,
    showConfirmDialog: state.showConfirmDialog,
    hideConfirmDialog: state.hideConfirmDialog,
}));

export default useAppStore;
