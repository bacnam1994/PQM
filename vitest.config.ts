import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  },
});
