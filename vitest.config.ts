import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests inspect the stylesheet itself (click-through layering rules)
    css: true,
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
