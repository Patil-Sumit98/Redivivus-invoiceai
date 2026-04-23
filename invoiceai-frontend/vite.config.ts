import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 5173,
    // NOTE: Proxy rules removed because they conflict with React Router paths.
    // The apiClient in src/api/client.ts already calls http://localhost:8001 directly,
    // so no proxying is needed. The previous '/invoices' proxy rule was intercepting
    // SPA page navigations like /invoices/:id and forwarding them to the backend
    // instead of letting React Router handle them.
  }
})
