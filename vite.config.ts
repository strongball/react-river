import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'example'),
  plugins: [react()],
  resolve: {
    alias: {
      '@zerologix/react-river': resolve(__dirname, 'src/index.ts'),
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
