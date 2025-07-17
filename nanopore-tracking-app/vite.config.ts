import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      // Prevent pg from being bundled
      'pg': 'pg-browser-stub',
      'pg-native': 'pg-browser-stub',
      'pg-pool': 'pg-browser-stub',
      'pg-protocol': 'pg-browser-stub',
      'pg-types': 'pg-browser-stub',
      'pgpass': 'pg-browser-stub',
    }
  },
  optimizeDeps: {
    exclude: ['pg', 'pg-native', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass']
  },
  build: {
    rollupOptions: {
      external: ['pg', 'pg-native', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass']
    }
  }
}) 