import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // needed? environment: 'node',
    root: '.', // Ensures tests run from package root
  },
});
