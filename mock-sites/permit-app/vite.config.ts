import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { permitMockApiPlugin } from './src/mockApi/plugin'

export default defineConfig({
  plugins: [react(), permitMockApiPlugin()],
  server: {
    port: 4000,
    proxy: {
      // r4mi backend endpoints — observe, sse, logs, agents, chat.
      // /api/stubs/* is intentionally NOT proxied: it's served in-process by
      // permitMockApiPlugin so the permit app's stub data stays self-contained
      // and r4mi backend carries zero domain knowledge.
      '^/api/(?!stubs/).*': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
