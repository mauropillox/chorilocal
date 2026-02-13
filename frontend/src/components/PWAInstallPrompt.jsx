import { useEffect, useState, useCallback } from 'react';

/**
 * Detect if running on iOS (iPhone/iPad/iPod or iPad with desktop UA)
 */
export function detectIsIOS() {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect if app is already installed as PWA (standalone mode)
 */
export function detectIsInstalled() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;
}

/**
 * iOS Install Instructions Modal — can be triggered from anywhere
 */
export function IOSInstallModal({ open, onClose }) {
    if (!open) return null;

    return (
        <div className="pwa-ios-modal-backdrop" onClick={onClose}>
            <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pwa-ios-modal-header">
                    <img src="/pwa-icon-192.png" alt="FrioSur" className="pwa-install-logo" />
                    <strong>Instalar FrioSur en tu iPhone</strong>
                    <button className="pwa-dismiss-btn" onClick={onClose} aria-label="Cerrar" style={{ color: '#666' }}>✕</button>
                </div>
                <div className="pwa-ios-modal-steps">
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">1</span>
                        <span>Abrí la app en <strong>Safari</strong> (no Chrome ni otro navegador)</span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">2</span>
                        <span>Buscá este ícono <span className="pwa-ios-share-icon-box">⬆</span> en la barra de abajo de Safari y tocalo</span>
                    </div>
                    <div className="pwa-ios-step pwa-ios-step-note">
                        <span className="pwa-ios-step-num">!</span>
                        <span>Ojo: dice &quot;Compartir&quot; pero <strong>NO</strong> es para compartir. Es el único lugar donde Apple pone la opción de instalar.</span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">3</span>
                        <span>En el menú que se abre, deslizá hacia abajo y tocá <strong>&quot;Agregar a pantalla de inicio&quot;</strong> <span className="pwa-ios-plus-icon">⊕</span></span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">4</span>
                        <span>Tocá <strong>&quot;Agregar&quot;</strong> arriba a la derecha</span>
                    </div>
                </div>
                <p className="pwa-ios-modal-note">
                    ¡Listo! La app aparecerá en tu pantalla como un ícono.
                    Funciona sin internet y se abre pantalla completa.
                </p>
                <button className="pwa-install-btn pwa-ios-modal-ok" onClick={onClose}>
                    Entendido
                </button>
            </div>
        </div>
    );
}

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
    const [showIOSModal, setShowIOSModal] = useState(false);

    useEffect(() => {
        // Already installed as PWA?
        if (detectIsInstalled()) {
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
        const isiOS = detectIsIOS();
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
        <>
            <div className="pwa-install-banner" role="alert">
                <div className="pwa-install-content">
                    <img src="/pwa-icon-192.png" alt="FrioSur" className="pwa-install-logo" />
                    <div className="pwa-install-text">
                        {isIOS ? (
                            <>
                                <strong>Instalá FrioSur</strong>
                                <span>Tocá acá para ver cómo instalarlo</span>
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
                            <button className="pwa-install-btn" onClick={() => setShowIOSModal(true)}>
                                Ver pasos
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
            {isIOS && <IOSInstallModal open={showIOSModal} onClose={() => { setShowIOSModal(false); handleDismiss(); }} />}
        </>
    );
}
