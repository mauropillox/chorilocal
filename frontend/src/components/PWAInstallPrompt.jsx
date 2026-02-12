import { useEffect, useState, useCallback } from 'react';

/**
 * PWA Install Prompt — shows a dismissible banner encouraging
 * users to install the app to their home screen.
 * - Captures the `beforeinstallprompt` event
 * - Dismissal is stored in localStorage for 7 days
 * - Works on Chrome, Edge, Samsung Internet, Opera (Android)
 * - Falls back to iOS instructions on Safari
 */
export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Already installed as PWA?
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true);
            return;
        }

        // Check dismiss timestamp
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedAt = parseInt(dismissed, 10);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedAt < sevenDays) return;
        }

        // iOS detection
        const ua = window.navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(isiOS);

        if (isiOS) {
            // Show manual instructions for iOS (no beforeinstallprompt)
            setShowBanner(true);
            return;
        }

        // Standard install prompt (Chrome, Edge, Samsung Internet)
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowBanner(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
        setShowBanner(false);
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        localStorage.setItem('pwa-install-dismissed', String(Date.now()));
        setShowBanner(false);
    }, []);

    if (isInstalled || !showBanner) return null;

    return (
        <div className="pwa-install-banner" role="alert">
            <div className="pwa-install-content">
                <img src="/pwa-icon-192.png" alt="FrioSur" className="pwa-install-logo" />
                <div className="pwa-install-text">
                    {isIOS ? (
                        <>
                            <strong>Instalá FrioSur</strong>
                            <span>
                                1. Tocá <span className="pwa-ios-share">⬆</span> (Compartir)
                            </span>
                            <span>
                                2. &quot;Agregar a pantalla de inicio&quot;
                            </span>
                        </>
                    ) : (
                        <>
                            <strong>Instalá FrioSur</strong>
                            <span>Acceso rápido desde tu pantalla de inicio</span>
                        </>
                    )}
                </div>
                <div className="pwa-install-actions">
                    {isIOS ? (
                        <button className="pwa-install-btn" onClick={handleDismiss}>
                            Entendido
                        </button>
                    ) : (
                        <button className="pwa-install-btn" onClick={handleInstall}>
                            Instalar
                        </button>
                    )}
                    <button className="pwa-dismiss-btn" onClick={handleDismiss} aria-label="Cerrar">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}
