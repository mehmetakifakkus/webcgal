import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // own outDir: the e2e build contains the debug hook and must never end up in dist/
        command: 'VITE_E2E=1 vite build --outDir dist-e2e && vite preview --outDir dist-e2e --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
