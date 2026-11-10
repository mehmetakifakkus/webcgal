import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  // paper is only imported by the engine; pre-bundle it so the first browser run does not reload.
  optimizeDeps: { include: ['paper', '@uiw/react-codemirror'] },
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // desktop width: below 720px the main nav collapses into a menu button
            viewport: { width: 1280, height: 800 },
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
