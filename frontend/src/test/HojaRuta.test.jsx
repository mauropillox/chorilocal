/**
 * Tests para HojaRuta.jsx - Componente de gestión de estados de pedidos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HojaRuta from '../components/HojaRuta.jsx'

// Mock del contexto de autenticación
const mockUser = {
    username: 'testuser',
    rol: 'admin',
    activo: true
}

// Mock de datos de pedidos
const mockPedidos = [
    {
        id: 1,
        cliente: { nombre: 'Cliente 1', telefono: '099111111' },
        productos: [
            { nombre: 'Producto 1', cantidad: 2, precio: 10.0, tipo: 'unidad' }
        ],
        fecha: '2026-01-08',
        estado: 'pendiente',
        total: 20.0
    },
    {
        id: 2,
        cliente: { nombre: 'Cliente 2', telefono: '099222222' },
        productos: [
            { nombre: 'Producto 2', cantidad: 1, precio: 15.0, tipo: 'unidad' }
        ],
        fecha: '2026-01-08',
        estado: 'preparando',
        total: 15.0
    },
    {
        id: 3,
        cliente: { nombre: 'Cliente 3', telefono: '099333333' },
        productos: [
            { nombre: 'Producto 3', cantidad: 3, precio: 5.0, tipo: 'unidad' }
        ],
        fecha: '2026-01-08',
        estado: 'entregado',
        total: 15.0
    }
]

// Helper function para renderizar con contexto
const renderWithRouter = (component) => {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    )
}

// Mock de fetch para API calls
const mockFetch = (data, status = 200) => {
    global.fetch = vi.fn(() =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(data),
        })
    )
}

describe('HojaRuta - Estados Workflow', () => {
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks()

        // Mock localStorage con usuario
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'user') return JSON.stringify(mockUser)
            return null
        })

        // Mock fetch para obtener pedidos
        mockFetch(mockPedidos)
    })

    it('renderiza correctamente con pedidos', async () => {
        renderWithRouter(<HojaRuta />)

        // Verificar que el componente se renderiza
        expect(screen.getByText('Hoja de Ruta')).toBeInTheDocument()

        // Esperar a que carguen los pedidos
        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
            expect(screen.getByText('Cliente 2')).toBeInTheDocument()
            expect(screen.getByText('Cliente 3')).toBeInTheDocument()
        })
    })

    it('muestra estados correctos del nuevo workflow', async () => {
        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            // Verificar tarjetas de estados (solo los nuevos estados)
            expect(screen.getByText('Pendiente')).toBeInTheDocument()
            expect(screen.getByText('Preparando')).toBeInTheDocument()
            expect(screen.getByText('Entregado')).toBeInTheDocument()

            // Verificar que NO aparecen estados obsoletos
            expect(screen.queryByText('Tomado')).not.toBeInTheDocument()
            expect(screen.queryByText('Listo')).not.toBeInTheDocument()
        })
    })

    it('permite cambiar estado de pendiente a preparando', async () => {
        // Mock API call para cambio de estado
        mockFetch({ success: true })

        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        })

        // Buscar botón de cambio de estado para pedido pendiente
        const cambiarEstadoBtns = screen.getAllByText('📋 Preparar')
        expect(cambiarEstadoBtns.length).toBeGreaterThan(0)

        // Simular click en cambiar estado
        fireEvent.click(cambiarEstadoBtns[0])

        // Verificar que se hace la llamada a la API
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pedidos/1/estado'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ estado: 'preparando' })
                })
            )
        })
    })

    it('permite cambiar estado de preparando a entregado', async () => {
        mockFetch({ success: true })

        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 2')).toBeInTheDocument()
        })

        // Buscar botón para entregar pedido en preparación
        const entregarBtns = screen.getAllByText('🚚 Entregar')
        expect(entregarBtns.length).toBeGreaterThan(0)

        fireEvent.click(entregarBtns[0])

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pedidos/2/estado'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ estado: 'entregado' })
                })
            )
        })
    })

    it('permite cancelar pedidos', async () => {
        mockFetch({ success: true })

        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        })

        // Buscar botón de cancelar
        const cancelarBtns = screen.getAllByText('❌ Cancelar')
        expect(cancelarBtns.length).toBeGreaterThan(0)

        fireEvent.click(cancelarBtns[0])

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pedidos/1/estado'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ estado: 'cancelado' })
                })
            )
        })
    })

    it('filtra pedidos por estado correctamente', async () => {
        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        })

        // Click en filtro "Pendiente"
        const filtrosPendiente = screen.getAllByText('Pendiente')
        fireEvent.click(filtrosPendiente[0]) // El primero es la tarjeta de filtro

        // Verificar que solo se muestran pedidos pendientes
        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
            expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument()
            expect(screen.queryByText('Cliente 3')).not.toBeInTheDocument()
        })
    })

    it('muestra contadores de estados correctos', async () => {
        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            // Verificar contadores basados en mockPedidos
            expect(screen.getByText('1')).toBeInTheDocument() // 1 pendiente
            expect(screen.getByText('1')).toBeInTheDocument() // 1 preparando  
            expect(screen.getByText('1')).toBeInTheDocument() // 1 entregado
        })
    })

    it('maneja errores de API correctamente', async () => {
        // Mock error response
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' }),
            })
        )

        renderWithRouter(<HojaRuta />)

        // Verificar que se muestra mensaje de error
        await waitFor(() => {
            expect(screen.getByText(/Error al cargar/)).toBeInTheDocument()
        })
    })

    it('no permite transiciones de estado inválidas', async () => {
        // Mock pedido ya entregado
        const pedidosConEntregado = [{
            ...mockPedidos[0],
            estado: 'entregado'
        }]

        mockFetch(pedidosConEntregado)

        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        })

        // No debería haber botones de cambio de estado para pedidos entregados
        expect(screen.queryByText('📋 Preparar')).not.toBeInTheDocument()
        expect(screen.queryByText('🚚 Entregar')).not.toBeInTheDocument()
    })
})

describe('HojaRuta - Funcionalidad General', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'user') return JSON.stringify(mockUser)
            return null
        })
        mockFetch(mockPedidos)
    })

    it('renderiza ayuda cuando se solicita', async () => {
        renderWithRouter(<HojaRuta />)

        // Click en botón de ayuda
        const ayudaBtn = screen.getByText('❓')
        fireEvent.click(ayudaBtn)

        // Verificar que se muestra la ayuda
        expect(screen.getByText('Guía Rápida')).toBeInTheDocument()
        expect(screen.getByText(/Clickeá las tarjetas de colores/)).toBeInTheDocument()
    })

    it('permite buscar pedidos por cliente', async () => {
        renderWithRouter(<HojaRuta />)

        await waitFor(() => {
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        })

        // Buscar input de búsqueda
        const searchInput = screen.getByPlaceholderText(/Buscar por cliente/)

        // Escribir nombre de cliente
        fireEvent.change(searchInput, { target: { value: 'Cliente 2' } })

        // Verificar filtrado
        await waitFor(() => {
            expect(screen.getByText('Cliente 2')).toBeInTheDocument()
            expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument()
            expect(screen.queryByText('Cliente 3')).not.toBeInTheDocument()
        })
    })

    it('maneja estado de carga correctamente', async () => {
        // Mock delay in fetch
        global.fetch = vi.fn(() => new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(mockPedidos)
        }), 100)))

        renderWithRouter(<HojaRuta />)

        // Verificar estado de carga inicial
        expect(screen.getByText(/Cargando/)).toBeInTheDocument()

        // Esperar a que termine la carga
        await waitFor(() => {
            expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument()
            expect(screen.getByText('Cliente 1')).toBeInTheDocument()
        }, { timeout: 2000 })
    })
})