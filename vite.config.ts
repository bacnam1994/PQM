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