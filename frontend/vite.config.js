// vite.config.js - optimized for performance & code-splitting

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react({
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
      // Faster builds in dev
      fastRefresh: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo-friosur.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'FrioSur Pedidos',
        short_name: 'FrioSur',
        description: 'Gestión de pedidos y clientes — FrioSur',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // Pre-cache app shell (HTML, JS, CSS)
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // API calls: network-first with fallback
            urlPattern: /^https:\/\/api\.pedidosfriosur\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Images: cache-first
            urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
        // Don't precache source maps
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Clean old caches on update
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false, // Enable via `enabled: true` for local SW testing
      },
    }),
  ],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['tests/**', 'node_modules/**'],
    // Ensure proper JSX handling in tests
    deps: {
      optimizer: {
        web: {
          include: ['react', 'react-dom']
        }
      }
    }
  },

  build: {
    // Code-splitting for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-select')) {
              return 'vendor';
            }
          }
        }
      },
      // Handle optional dependencies
      external: (id) => {
        // Make Sentry optional for build
        if (id === '@sentry/react' && !process.env.VITE_SENTRY_DSN) {
          return true;
        }
        return false;
      }
    },
    // Optimize bundle
    minify: 'terser',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
    reportCompressedSize: false
  },

  // Tree-shaking & resolution
  resolve: {
    alias: {
      '@': '/src'
    }
  },

  server: {
    middlewareMode: false,
    hmr: {
      host: 'localhost',
      port: 5173
    }
    // LOCAL DEV ONLY: Uncomment this proxy block to forward /api calls to local backend
    // proxy: {
    //   '/api': {
    //     target: 'http://127.0.0.1:8000',
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/api/, '')
    //   }
    // }
  }
});
// Cache bust: 1737509998
