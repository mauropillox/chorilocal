import { useEffect, useState } from 'react';
import sync from '../offline/sync';
import { toastSuccess, toastError } from '../toast';
import { logger } from '../utils/logger';

export default function OfflineQueue() {
    const [items, setItems] = useState([]);
    const [processing, setProcessing] = useState(false);

    const load = async () => {
        try {
            const all = await sync.getAll();
            setItems(all);
            toastSuccess('📡 Cola offline cargada correctamente');
        } catch (e) { logger.error('OfflineQueue load error:', e); }
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
        <div className="offline-queue-page">
            <h2>Cola offline</h2>
            <div className="offline-queue-actions">
                <button onClick={resendAll} className="btn-primary" disabled={processing}>{processing ? '⏳ Procesando...' : 'Reenviar cola'}</button>
                <button onClick={clearAll} className="btn-ghost">Limpiar cola</button>
            </div>

            {items.length === 0 ? (
                <div className="empty-state">No hay items en la cola</div>
            ) : (
                <div className="offline-queue-list">
                    {items.map(it => (
                        <div key={it.id} className="card-item">
                            <div className="offline-queue-item">
                                <div className="offline-queue-item-info">
                                    <div className="offline-queue-item-method">{it.method} — {it.url}</div>
                                    <div className="offline-queue-item-time">{it.ts ? new Date(it.ts).toLocaleString() : ''}</div>
                                    {it.body && <pre className="offline-queue-item-body">{JSON.stringify(it.body, null, 2)}</pre>}
                                </div>
                                <div className="offline-queue-item-actions">
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
