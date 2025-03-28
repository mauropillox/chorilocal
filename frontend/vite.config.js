import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
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
            src: '/pwa-icon-192.png',  // This will be generated automatically
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',  // This will be generated automatically
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      // This part automatically generates icons
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,jpg,jpeg,svg}'],  // Modify as necessary for your files
      },
      icons: {
        // You can specify your base image here to generate icons of various sizes
        src: '/logo.png',  // Make sure this is the correct path to your base logo
        sizes: [192, 512],  // You can define more sizes if needed
        purpose: 'any maskable',
      },
    }),
  ],
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  build: {
    outDir: 'build',
    assetsDir: 'assets',  // Ensure the assets go to the correct directory
  },
});
