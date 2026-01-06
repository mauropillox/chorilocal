import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './utils'
// Este código permite que los polyfills estén disponibles globalmente
import { Buffer } from 'buffer';
window.Buffer = Buffer;

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
    <App />
  </StrictMode>,
)

// Register service worker and online handler for queue processing
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(e => console.warn('SW registration failed', e));
}

import { processQueue } from './offline/sync';
window.addEventListener('online', () => {
  try { processQueue(); } catch (e) { console.warn('processQueue failed', e); }
});

// Try processing any queued items on load
if (navigator.onLine) {
  try { processQueue(); } catch (e) { }
}
