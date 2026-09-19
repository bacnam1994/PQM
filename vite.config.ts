/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Firebase Hosting phục vụ từ root '/' — không cần prefix như GitHub Pages
  base: '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/store/test-result-form.spec.ts'],
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
}));
