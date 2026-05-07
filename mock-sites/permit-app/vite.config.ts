import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { permitMockApiPlugin } from './src/mockApi/plugin'

export default defineConfig({
  plugins: [react(), permitMockApiPlugin()],
  server: {
    port: 4000,
    proxy: {
      // Proxy all /api/* to r4mi backend. The permitMockApiPlugin middleware
      // runs first and handles /api/stubs/* in-process before the proxy sees
      // them — so stubs never reach the backend and /api/observe, /api/sse, etc.
      // are correctly forwarded.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // preview mode (used in CI): same proxy config
  preview: {
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
