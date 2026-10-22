import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 5181;

// Takes the store screenshots (`pnpm screenshots`) with the built extension, on store/pages.
export default defineConfig({
  testDir: '.',
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'node e2e/serve.ts',
    cwd: resolve(import.meta.dirname, '..'),
    env: { PORT: `${PORT}`, ROOT: 'store/pages' },
    port: PORT,
    reuseExistingServer: true,
  },
});
