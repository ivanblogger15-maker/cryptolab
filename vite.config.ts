import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages, custom domains or a local file server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
