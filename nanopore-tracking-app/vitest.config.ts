import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Include only unit test files
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}'
    ],
    // Exclude Playwright and E2E tests
    exclude: [
      'tests/e2e/**/*',
      'tests/global-setup.ts',
      'tests/global-teardown.ts',
      'tests/utils/test-helpers.ts',
      'node_modules/**/*'
    ],
    environment: 'jsdom',
    globals: true,
    setupFiles: []
  }
}) 