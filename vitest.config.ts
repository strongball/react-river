import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/__tests__/**', 'src/devtools/**'],
      thresholds: {
        lines: 93,
        branches: 82,
        functions: 94,
        statements: 91,
      },
    },
  },
  resolve: {
    alias: {
      '@stball/react-river': resolve(import.meta.dirname, 'src/index.ts'),
    },
  },
});
