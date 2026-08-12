/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
  plugins: [
    react()
  ],
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000, // Tăng giới hạn cảnh báo dung lượng (Firebase khá nặng)
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  }
}));