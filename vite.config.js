import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5174,
    strictPort: false,
    open: true,

    hmr: {
      protocol: 'wss',
      host: true,   // ✅ fixed
      port: 5174,
      overlay: false,
    },

    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    },

    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/login': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    sourcemap: false
  }
})