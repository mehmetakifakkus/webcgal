import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // paper.js and CodeMirror are only needed by pages with a code runner; keep them in their own chunks.
        codeSplitting: {
          groups: [
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
