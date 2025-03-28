import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Keep service worker up-to-date
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png', 'pwa-icon-192.png', 'pwa-icon-512.png'],
      manifest: {
        name: 'Casa de Congelados',
        short_name: 'Congelados',
        description: 'Gestión de pedidos, clientes y productos',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon-192.png',  // Ensure this is in the public folder
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',  // Ensure this is in the public folder
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      buffer: 'buffer', // Alias for buffer
      'react-router-dom': require.resolve('react-router-dom'), // Resolve the path correctly for react-router-dom
    },
  },
  build: {
    outDir: 'build',  // Specify the output directory explicitly
    assetsDir: 'assets',  // Make sure assets go to a specific folder
  },
});
