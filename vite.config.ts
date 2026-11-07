import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';

export default defineConfig({
  // Sub-path deployments (GitHub Pages serves the site at /webcgal/): VITE_BASE=/webcgal/ npm run build
  base: process.env.VITE_BASE || '/',
  build: {
    rolldownOptions: {
      output: {
        // paper.js and CodeMirror are only needed by pages with a code runner; keep them in their own chunks.
        // React goes first into its own group: otherwise the codemirror group pulls it in (via @uiw) and the
        // entry chunk would statically import, and preload, the CodeMirror chunks on every page.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              priority: 3,
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/,
            },
            { name: 'paper', test: /node_modules[\\/]paper[\\/]/ },
            { name: 'codemirror-lang', priority: 1, test: /node_modules[\\/](@lezer|@codemirror[\\/](lang-javascript|language|autocomplete|lint))[\\/]/ },
            { name: 'codemirror', test: /node_modules[\\/](@codemirror|@lezer|@uiw|codemirror|crelt|style-mod|w3c-keyname)[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [{ enforce: 'pre', ...mdx() }, react({ include: /\.(mdx|js|jsx|ts|tsx)$/ })],
});
