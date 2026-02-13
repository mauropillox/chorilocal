import { useState, useEffect, useRef } from 'react';
import { processQueue } from '../offline/sync';
import { queryClient } from '../utils/queryClient';
import { logger } from '../utils/logger';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('online'); // online, offline, reconnecting
  const [showBanner, setShowBanner] = useState(false);
  const statusRef = useRef(status);
  const bannerTimeoutRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const handleOnline = () => {
      const wasOffline = statusRef.current === 'offline' || statusRef.current === 'reconnecting';
      setStatus('online');
      setShowBanner(true);
      // Clear any existing timeout to prevent memory leak
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      // Hide the "online" banner after 3 seconds
      bannerTimeoutRef.current = setTimeout(() => setShowBanner(false), 3000);

      // On reconnection: process offline queue + refetch stale data
      if (wasOffline) {
        try { processQueue(); } catch (e) { logger.warn('processQueue on reconnect failed', e); }
        try { queryClient.invalidateQueries(); } catch (e) { logger.warn('invalidateQueries on reconnect failed', e); }
      }
    };

    const handleOffline = () => {
      setStatus('offline');
      setShowBanner(true);
    };

    // Check API health periodically
    const checkApiHealth = async () => {
      if (!navigator.onLine) {
        setStatus('offline');
        setShowBanner(true);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${import.meta.env.VITE_API_URL}/health`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          if (statusRef.current === 'offline' || statusRef.current === 'reconnecting') {
            handleOnline(); // This triggers processQueue + invalidateQueries
          }
        } else {
          if (statusRef.current === 'online') {
            setStatus('reconnecting');
            setShowBanner(true);
          }
        }
      } catch (e) {
        if (statusRef.current === 'online') {
          setStatus('reconnecting');
          setShowBanner(true);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check API health every 30 seconds
    const interval = setInterval(checkApiHealth, 30000);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      // Clean up banner timeout to prevent memory leak
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []); // Empty deps - effect runs once, uses ref for status

  if (!showBanner) return null;

  const messages = {
    offline: { icon: '📡', text: 'Sin conexión a internet' },
    reconnecting: { icon: '⏳', text: 'Reconectando al servidor...' },
    online: { icon: '✅', text: 'Conexión restablecida' }
  };

  const msg = messages[status];

  return (
    <div className={`connection-banner ${status}`}>
      <span className={status === 'reconnecting' ? 'pulse' : ''}>{msg.icon}</span>
      <span>{msg.text}</span>
      {status === 'offline' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            padding: '4px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'white',
            fontSize: '0.8rem',
            fontWeight: 600,
            minHeight: 'auto'
          }}
        >
          🔄 Reintentar
        </button>
      )}
    </div>
  );
}
