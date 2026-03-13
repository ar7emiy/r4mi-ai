import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,         // beats are stateful — run serially
  timeout: 180_000,             // 180s per test (Gemini calls can take 10-20s each; 6 calls total)
  expect: { timeout: 30_000 },  // 30s for SSE-driven UI changes
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: process.env.PWSLOWMO ? parseInt(process.env.PWSLOWMO) : 0,
    },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
})
