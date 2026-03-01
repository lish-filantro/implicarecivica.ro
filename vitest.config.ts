import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/test-env.ts'],
    testTimeout: 60_000, // 60s per test (OCR/AI calls are slow)
    hookTimeout: 30_000,
    // Run test suites sequentially (shared DB state)
    sequence: { concurrent: false },
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
