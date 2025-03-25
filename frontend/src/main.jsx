import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Este código permite que los polyfills estén disponibles globalmente
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Make sure other global polyfills are available
import process from 'process';
window.process = process;


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
