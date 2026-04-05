/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // Optional: if you have a setup file
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'V-Biotech QMS',
        short_name: 'QMS',
        description: 'Hệ thống Quản lý Chất lượng V-Biotech',
        theme_color: '#ffffff',
        background_color: '#f8faf9',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000, // Tăng giới hạn cảnh báo dung lượng (Firebase khá nặng)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-core';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase-vendor';
          }
          if (id.includes('node_modules/recharts')) {
            return 'recharts-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-vendor';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger'], // Tự động xóa các log khi build lên production
  }
});