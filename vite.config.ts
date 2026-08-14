import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: resolve(import.meta.dirname, 'example'),
  plugins: [react()],
  resolve: {
    alias: {
      '@stball/react-river': resolve(import.meta.dirname, 'src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
