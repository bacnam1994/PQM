/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // Optional: if you have a setup file
  },
  plugins: [
    react()
  ],
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000, // Tăng giới hạn cảnh báo dung lượng (Firebase khá nặng)
  },
  esbuild: {
    drop: ['console', 'debugger'], // Tự động xóa các log khi build lên production
  }
});