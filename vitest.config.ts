import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/main/services/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/services/**/*.ts'],
      exclude: ['src/main/services/__tests__/**'],
      reporter: ['text', 'lcov'],
    },
    // Resolve aliases idênticos ao tsconfig
    alias: {
      electron: path.resolve(__dirname, 'src/main/services/__tests__/__mocks__/electron.ts'),
      'electron-store': path.resolve(__dirname, 'src/main/services/__tests__/__mocks__/electron-store.ts'),
    },
  },
});
