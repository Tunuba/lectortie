import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// En desarrollo la API vive en el servidor de Go, en el 8097.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8097', '/portadas': 'http://127.0.0.1:8097', '/entrar': 'http://127.0.0.1:8097' } },
  build: { target: 'es2020', cssCodeSplit: true, chunkSizeWarningLimit: 600 }
})
