import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pqm/release-engine': path.resolve(__dirname, './packages/release-engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    // Loại trừ các file Playwright E2E test để tránh conflict với Vitest
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      'tests/*.spec.ts',
      '**/store/test-result-form.spec.ts',
    ],
    env: {
      VITE_FIREBASE_API_KEY: 'AIzaSyTestSafeMockApiKeyForVitest001',
      VITE_FIREBASE_AUTH_DOMAIN: 'v-biotech-test.firebaseapp.com',
      VITE_FIREBASE_DATABASE_URL:
        'https://v-biotech-default-rtdb.asia-southeast1.firebasedatabase.app',
      VITE_FIREBASE_PROJECT_ID: 'v-biotech-test',
      VITE_FIREBASE_STORAGE_BUCKET: 'v-biotech-test.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '1089547502816',
      VITE_FIREBASE_APP_ID: '1:1089547502816:web:testmockappid0001',
      VITE_FIREBASE_MEASUREMENT_ID: 'G-BP6DWC5QP1',
    },
  },
});
