import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sync from '../offline/sync';
import { logger } from '../utils/logger';

export default function OfflineNotifier() {
    const [count, setCount] = useState(0);
    const navigate = useNavigate();

    const refreshCount = async () => {
        try {
            const items = await sync.getAll();
            setCount(items.length);
        } catch (e) { logger.warn('OfflineNotifier: failed to getAll', e); }
    };

    useEffect(() => {
        refreshCount();
        const handler = () => refreshCount();
        window.addEventListener('offline-request-queued', handler);
        window.addEventListener('online', refreshCount);
        const iv = setInterval(refreshCount, 10000);
        return () => { window.removeEventListener('offline-request-queued', handler); window.removeEventListener('online', refreshCount); clearInterval(iv); };
    }, []);

    if (count === 0) return null;

    return (
        <div style={{ position: 'fixed', right: '18px', bottom: '18px', zIndex: 3000 }}>
            <button
                onClick={() => navigate('/offline-queue')}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}
                title="Ver solicitudes en cola"
            >
                📨 Cola offline
                <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontWeight: 700 }}>{count}</span>
            </button>
        </div>
    );
}
