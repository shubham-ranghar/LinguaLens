import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Loads `.env` / `.env.*` so `import.meta.env.VITE_*` works in tests
  envDir: '.',
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/*': path.resolve(__dirname, './src/*'),
    },
  },
});
