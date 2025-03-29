// vite.config.js (sin Service Worker, con comentarios para futuro)

// import { VitePWA } from 'vite-plugin-pwa'; // 🔒 Desactivado temporalmente

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),

    // 💤 Plugin PWA desactivado porque causaba problemas de cacheo en producción
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.svg', 'robots.txt'],
    //   manifest: {
    //     name: 'Chorizaurio App',
    //     short_name: 'Chorizaurio',
    //     start_url: '/',
    //     display: 'standalone',
    //     background_color: '#ffffff',
    //     description: 'Gestión de congelados',
    //     icons: [
    //       {
    //         src: 'pwa-icon-192.png',
    //         sizes: '192x192',
    //         type: 'image/png'
    //       },
    //       {
    //         src: 'pwa-icon-512.png',
    //         sizes: '512x512',
    //         type: 'image/png'
    //       }
    //     ]
    //   }
    // })
  ]
});