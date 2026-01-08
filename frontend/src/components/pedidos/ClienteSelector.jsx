/**
 * ClienteSelector - Reusable client selection component
 * Extracted from Pedidos.jsx for better maintainability
 */
import React, { useMemo } from 'react';
import Select from 'react-select';
import { selectStyles } from '../selectStyles';

export default function ClienteSelector({
    clientes,
    clienteId,
    setClienteId,
    loading = false,
    placeholder = "Seleccionar cliente..."
}) {
    const clienteOptions = useMemo(() =>
        clientes.map(c => ({
            value: c.id,
            label: `${c.nombre}${c.zona ? ` (${c.zona})` : ''}`
        })),
        [clientes]
    );

    const selectedCliente = useMemo(() =>
        clienteOptions.find(opt => opt.value === Number(clienteId)) || null,
        [clienteOptions, clienteId]
    );

    return (
        <div className="cliente-selector">
            <label className="form-label">
                👤 Cliente
            </label>
            <Select
                options={clienteOptions}
                value={selectedCliente}
                onChange={(opt) => setClienteId(opt ? opt.value : '')}
                placeholder={loading ? "Cargando clientes..." : placeholder}
                isLoading={loading}
                isClearable
                isSearchable
                styles={selectStyles}
                noOptionsMessage={() => "No hay clientes"}
                loadingMessage={() => "Buscando..."}
                aria-label="Seleccionar cliente"
            />
        </div>
    );
}
