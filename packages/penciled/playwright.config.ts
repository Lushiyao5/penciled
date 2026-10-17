import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;

// End-to-end tests of the full flow against e2e/index.html, on desktop and emulated mobile.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    command: `vite e2e --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'android', use: devices['Pixel 7'] },
    { name: 'ios', use: devices['iPhone 15'] },
  ],
});
