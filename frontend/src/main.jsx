import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './utils'
import { logger } from './utils/logger'
import { ReactQueryProvider } from './utils/queryClient.jsx';
// Este código permite que los polyfills estén disponibles globalmente
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Sentry for error tracking (optional)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN && typeof window !== 'undefined') {
  // Use dynamic import with proper error handling
  const loadSentry = async () => {
    try {
      const { init, browserTracingIntegration, replayIntegration } = await import("@sentry/react");
      init({
        dsn: SENTRY_DSN,
        integrations: [
          browserTracingIntegration(),
          replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: import.meta.env.MODE,
      });
    } catch (e) {
      logger.warn("Sentry not available:", e.message);
    }
  };
  loadSentry();
}

// Make sure other global polyfills are available
import process from 'process';
window.process = process;

// ONE-TIME RESET: Force light theme for all users (v2.0 reset)
// This clears any corrupted theme state from previous versions
const THEME_VERSION = 'v2.0';
if (localStorage.getItem('theme_version') !== THEME_VERSION) {
  localStorage.setItem('theme', 'light');
  localStorage.setItem('theme_version', THEME_VERSION);
  document.documentElement.removeAttribute('data-theme');
}

// Initialize theme from (now clean) localStorage
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReactQueryProvider>
      <App />
    </ReactQueryProvider>
  </StrictMode>,
)

// Register PWA service worker via vite-plugin-pwa (auto-update)
import { registerSW } from 'virtual:pwa-register';
import { toastInfo } from './toast';

const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-update: apply new SW immediately
    updateSW(true);
    toastInfo('✨ App actualizada');
  },
  onOfflineReady() {
    logger.info('App ready to work offline');
    toastInfo('📱 App lista para usar sin conexión');
  },
  onRegisteredSW(swUrl, r) {
    logger.info('SW registered:', swUrl);
    // Periodic check for updates (every 60 min)
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    }
  },
});

import { processQueue } from './offline/sync';
window.addEventListener('online', () => {
  try { processQueue(); } catch (e) { logger.warn('processQueue failed', e); }
});

// Try processing any queued items on load
if (navigator.onLine) {
  try { processQueue(); } catch (e) { }
}
