import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/invoices': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/review': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/webhooks': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
