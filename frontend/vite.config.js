// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000, // Este puerto se ignora en producción pero es útil localmente
  },
  preview: {
    port: process.env.PORT || 3000, // Railway lo sobrescribe con el puerto correcto
    host: true
  }
});
