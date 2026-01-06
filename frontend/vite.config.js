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
  }
});