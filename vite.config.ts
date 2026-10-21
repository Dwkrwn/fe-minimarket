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
})
