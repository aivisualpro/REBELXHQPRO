import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  return {
    test: {
      environment: 'jsdom',
      globals: true,
      env: loadEnv(mode, process.cwd(), ''),
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  };
});
