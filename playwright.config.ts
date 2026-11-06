import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'VITE_E2E=1 npm run build && npm run preview -- --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
