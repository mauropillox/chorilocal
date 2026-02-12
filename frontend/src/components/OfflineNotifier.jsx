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
        <div className="offline-notifier">
            <button
                onClick={() => navigate('/offline-queue')}
                className="offline-notifier-btn"
                title="Ver solicitudes en cola"
            >
                📨 Cola offline
                <span className="offline-notifier-badge">{count}</span>
            </button>
        </div>
    );
}
