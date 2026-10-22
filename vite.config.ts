/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

/**
 * SPA deep links need a 404.html that is a copy of index.html (the GitHub Pages fallback, as in Bioactive
 * Explorer). Delivery is `pages`; the deploy workflow copies it again after the build (KICKOFF §6b).
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(fileURLToPath(new URL('./dist', import.meta.url)));
      const index = path.join(dist, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'));
    },
  };
}

// BASE_PATH lets the same build deploy to a GitHub Pages sub-path: BASE_PATH=/toptechhr/.
// The local build uses base "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // No dev-only file-autosave endpoint (KICKOFF §4c): the Notebook lives in localStorage only.
  plugins: [react(), spaFallback()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link', '@tiptap/extension-task-list', '@tiptap/extension-task-item', '@tiptap/extension-placeholder'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
