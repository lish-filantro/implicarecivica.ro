import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // React components under test use the automatic JSX runtime (no React import)
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@m544': path.resolve(__dirname, 'src/manager-544'),
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
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
