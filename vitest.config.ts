import { defineConfig } from 'vitest/config';

/**
 * Vitest config, kept separate from vite.config.ts because that one sets
 * `root: 'client'` for the UI - tests must run from the repository root.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});