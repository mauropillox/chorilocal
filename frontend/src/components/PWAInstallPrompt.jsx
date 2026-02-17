import { useEffect, useState, useCallback } from 'react';

/**
 * Global store for the beforeinstallprompt event
 * This allows triggering install from anywhere (e.g., the "Más" menu)
 */
let _deferredInstallPrompt = null;

export function getDeferredPrompt() {
    return _deferredInstallPrompt;
}

export function clearDeferredPrompt() {
    _deferredInstallPrompt = null;
}

// Capture the event as early as possible at module level
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        _deferredInstallPrompt = e;
    });
}

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
 * Android Install Instructions Modal — manual fallback when
 * beforeinstallprompt is not available
 */
export function AndroidInstallModal({ open, onClose }) {
    if (!open) return null;

    return (
        <div className="pwa-ios-modal-backdrop" onClick={onClose}>
            <div className="pwa-ios-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pwa-ios-modal-header">
                    <img src="/pwa-icon-192.png" alt="FrioSur" className="pwa-install-logo" />
                    <strong>Instalar FrioSur en tu Android</strong>
                    <button className="pwa-dismiss-btn" onClick={onClose} aria-label="Cerrar" style={{ color: '#666' }}>✕</button>
                </div>
                <div className="pwa-ios-modal-steps">
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">1</span>
                        <span>Abrí la página <strong>www.pedidosfriosur.com</strong> en <strong>Chrome</strong></span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">2</span>
                        <span>Tocá los <strong>3 puntitos</strong> <span className="pwa-ios-share-icon-box">⋮</span> arriba a la derecha</span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">3</span>
                        <span>Buscá y tocá <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla de inicio"</strong></span>
                    </div>
                    <div className="pwa-ios-step">
                        <span className="pwa-ios-step-num">4</span>
                        <span>Tocá <strong>"Instalar"</strong> en el cartel que aparece</span>
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

        // iOS detection (must be before dismiss check — dismiss period differs)
        const isiOS = detectIsIOS();
        setIsIOS(isiOS);

        // Check dismiss timestamp — use versioned key so old dismissals don't block new banners
        const DISMISS_KEY = 'pwa-install-dismissed-v2';
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed) {
            const dismissedAt = parseInt(dismissed, 10);
            // iOS: only hide for 1 day (users need to see this more)
            // Android/desktop: hide for 7 days
            const hideMs = isiOS ? (1 * 24 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
            if (Date.now() - dismissedAt < hideMs) return;
        }

        if (isiOS) {
            // Show manual instructions for iOS (no beforeinstallprompt)
            setShowBanner(true);
            return;
        }

        // Check if we already captured the event at module level
        if (_deferredInstallPrompt) {
            setDeferredPrompt(_deferredInstallPrompt);
            setShowBanner(true);
            return;
        }

        // Standard install prompt (Chrome, Edge, Samsung Internet)
        const handler = (e) => {
            e.preventDefault();
            _deferredInstallPrompt = e;
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
        _deferredInstallPrompt = null;
        setShowBanner(false);
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        localStorage.setItem('pwa-install-dismissed-v2', String(Date.now()));
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
