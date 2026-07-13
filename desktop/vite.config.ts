import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      // Custom plugin to remove 'crossorigin' attributes added by Vite.
      // Electron's file:// protocol strictly blocks module scripts if they have crossorigin.
      name: 'remove-crossorigin',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace(/crossorigin/g, '');
      }
    }
  ],
  // Relative paths so Electron can load from file:// in production
  base: './',
  build: {
    // Disable modulePreload which also adds crossorigin links
    modulePreload: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
