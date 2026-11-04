import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const api = `http://localhost:${process.env.API_PORT ?? 8000}`;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000, proxy: { '/api': { target: api, changeOrigin: false } } },
  // unit tests sit beside the file they test (name.test.ts); npm test
  test: { environment: 'jsdom', restoreMocks: true, setupFiles: ['src/test-setup.ts'] },
});
