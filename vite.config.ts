/// <reference types="vitest" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendApiUrl = process.env.VITE_BACKEND_API_URL || env.VITE_BACKEND_API_URL;

  if (mode === 'production') {
    if (!backendApiUrl || !backendApiUrl.trim()) {
      throw new Error(
        'SECURITY BUILD GUARD: Missing mandatory environment variable VITE_BACKEND_API_URL in production build. Production bundles must have external backend authority URL configured.'
      );
    }
    const trimmed = backendApiUrl.trim();
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      throw new Error(
        `SECURITY BUILD GUARD: VITE_BACKEND_API_URL must NOT be localhost or 127.0.0.1 in production build! Received: ${trimmed}`
      );
    }
    if (!trimmed.startsWith('https://')) {
      throw new Error(
        `SECURITY BUILD GUARD: VITE_BACKEND_API_URL must use HTTPS protocol in production build! Received: ${trimmed}`
      );
    }
  }

  return {
    // Firebase Hosting phục vụ từ root '/' — không cần prefix như GitHub Pages
    base: '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@pqm/release-engine': path.resolve(__dirname, './packages/release-engine/src/index.ts'),
      },
    },
    plugins: [react()],
    build: {
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['@headlessui/react', '@heroicons/react'],
            'vendor-charts': ['recharts'],
            'vendor-query': [
              '@tanstack/react-query',
              '@tanstack/react-query-persist-client',
              '@tanstack/query-sync-storage-persister',
            ],
            'vendor-virtual': ['@tanstack/react-virtual'],
            'vendor-ai': ['@google/generative-ai'],
            'vendor-firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/database',
              'firebase/storage',
            ],
          },
        },
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
