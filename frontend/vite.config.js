// vite.config.js - optimized for performance & code-splitting

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // Code-splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-select'],
          'utils': ['./src/utils.js', './src/auth.js']
        }
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