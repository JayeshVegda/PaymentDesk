import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4782',
    trace: 'retain-on-failure',
    viewport: { width: 1680, height: 950 }
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:4782/api/health',
    reuseExistingServer: false,
    timeout: 30_000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } }]
});
