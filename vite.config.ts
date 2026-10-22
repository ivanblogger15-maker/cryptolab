import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages, custom domains or a local file server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // GitHub Pages serves the `main` branch's /docs folder, so the production
    // build goes straight there (no extra copy step, no CI required).
    outDir: 'docs',
    // Inline the (lazy-loaded) Brotli WASM as a data URL so the static build is
    // fully self-contained: no extra binary asset to host or copy around.
    assetsInlineLimit: 2_000_000,
  },
})
