import { defineConfig } from 'vitest/config'

// Isolated from vite.config.ts on purpose: loading the app's Cloudflare/generouted
// plugins under vitest trips a rolldown resolve-plugin bug. Unit tests run pure
// TS in a node env. Playwright specs (*.spec.ts) are excluded; they run via
// `deepspace test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.unit.test.ts', 'src/**/*.unit.test.ts'],
  },
})
