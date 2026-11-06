import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';

export default defineConfig({
  // paper.js and CodeMirror together exceed the default 500 kB warning; the app is one bundle on purpose.
  build: { chunkSizeWarningLimit: 1500 },
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [{ enforce: 'pre', ...mdx() }, react({ include: /\.(mdx|js|jsx|ts|tsx)$/ })],
});
