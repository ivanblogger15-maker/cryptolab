import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // The default export of brotli-wasm loads the WASM build over `fetch`,
      // which Node cannot do for `file://` URLs. Tests use the Node build.
      'brotli-wasm': fileURLToPath(
        new URL('./node_modules/brotli-wasm/index.node.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
