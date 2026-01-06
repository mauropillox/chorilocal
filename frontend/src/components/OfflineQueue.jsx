import { useEffect, useState } from 'react';
import sync from '../offline/sync';
import { toastSuccess, toastError } from '../toast';

export default function OfflineQueue() {
    const [items, setItems] = useState([]);
    const [processing, setProcessing] = useState(false);

    const load = async () => {
        try {
            const all = await sync.getAll();
            setItems(all);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    const removeItem = async (id) => {
        try {
            await sync.remove(id);
            toastSuccess('Elemento removido');
            await load();
        } catch (e) { toastError('Error removiendo item'); }
    };

    const resendAll = async () => {
        setProcessing(true);
        try {
            await sync.processQueue();
            toastSuccess('Reenvío completado (intentos realizados)');
            await load();
        } catch (e) { toastError('Error reintentando cola'); }
        setProcessing(false);
    };

    const clearAll = async () => {
        try {
            await sync.clearQueue();
            toastSuccess('Cola limpiada');
            await load();
        } catch (e) { toastError('Error limpiando cola'); }
    };

    return (
        <div style={{ padding: 16 }}>
            <h2>Cola offline</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={resendAll} className="btn-primary" disabled={processing}>{processing ? '⏳ Procesando...' : 'Reenviar cola'}</button>
                <button onClick={clearAll} className="btn-ghost">Limpiar cola</button>
            </div>

            {items.length === 0 ? (
                <div className="empty-state">No hay items en la cola</div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {items.map(it => (
                        <div key={it.id} className="card-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ maxWidth: '70%' }}>
                                    <div style={{ fontWeight: 600 }}>{it.method} — {it.url}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{it.ts ? new Date(it.ts).toLocaleString() : ''}</div>
                                    {it.body && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(it.body, null, 2)}</pre>}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => removeItem(it.id)} className="btn-ghost">Eliminar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
