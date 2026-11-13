import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import packageJson from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_RELEASE_DATE__: JSON.stringify(packageJson.releaseDate ?? ''),
  },
  plugins: [vue(), tailwindcss(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Only split libraries that are part of the entry bundle. Heavy,
          // lazy-only libraries (ag-grid, chart.js, leaflet, jspdf) are left to
          // Rollup's default splitting so they are not pulled into the initial
          // modulepreload graph.
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-lucide': ['lucide-vue-next'],
        },
      },
    },
  },
})
