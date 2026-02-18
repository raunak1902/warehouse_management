import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5174,
    strictPort: false,
    open: true,
    hmr: { overlay: false },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/login': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: { sourcemap: false }
})