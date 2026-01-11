// vite.config.js - optimized for performance & code-splitting

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
      // Faster builds in dev
      fastRefresh: true,
    })
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
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-select'],
          'utils': ['./src/utils.js', './src/auth.js']
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
// Cache bust: 1768146159
