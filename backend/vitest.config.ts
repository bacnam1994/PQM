import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@pqm/release-engine': path.resolve(__dirname, '../packages/release-engine/src/index.ts'),
    },
  },
});
