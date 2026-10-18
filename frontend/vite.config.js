import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // A public Codespaces port (the demo link) is served from *.app.github.dev
      allowedHosts: ['.app.github.dev'],
      // In development, /api calls are forwarded to the Node server (no CORS issues)
      proxy: { '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true } },
    },
    build: {
      rollupOptions: {
        output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom'] } },
      },
    },
  };
});
