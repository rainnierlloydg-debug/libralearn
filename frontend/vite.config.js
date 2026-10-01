import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// On Vercel (VERCEL=1) build a standalone SPA from index.html into dist/.
// Locally keep building into Laravel's public/build, served by the Blade view.
const standalone = process.env.VERCEL === '1' || process.env.BUILD_STANDALONE === '1';

const laravelBuild = {
  outDir: '../public/build',
  emptyOutDir: true,
  manifest: 'manifest.json',
  rollupOptions: {
    input: {
      app: path.resolve(__dirname, 'src/main.jsx'),
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/sanctum': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: standalone ? { outDir: 'dist', emptyOutDir: true } : laravelBuild,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});