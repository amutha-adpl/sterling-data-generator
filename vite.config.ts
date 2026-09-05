import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite serves the React UI on http://localhost:3000 during development and
 * proxies /api to the Express server on 3001.
 *
 * `npm run build` writes the production bundle to dist/client, which the
 * Express server then serves from the same origin.
 */
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Required so the UI works behind proxied preview domains.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});