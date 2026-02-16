import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5174,
    strictPort: false,
    open: true,
    // Disable HMR overlay that might cause flickering
    hmr: {
      overlay: false
    },
    // Optimize file watching
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    }
  },
  // Optimize build for development
  build: {
    sourcemap: false
  }
})