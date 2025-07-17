import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    ssr: {
      external: ['pg', 'pg-native', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass']
    },
    optimizeDeps: {
      exclude: ['pg', 'pg-native', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass']
    }
  }
});