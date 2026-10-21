import { defineConfig } from '@playwright/test';

const PORT = 5180;

// End-to-end tests of the built extension (.output/chrome-mv3) in Chromium, on local fixtures.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `node e2e/serve.ts`,
    env: { PORT: `${PORT}` },
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
