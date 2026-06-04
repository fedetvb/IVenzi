import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

function removeCrossoriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const isElectron = !!process.env.ELECTRON;
  return {
    plugins: [react(), ...(isElectron ? [removeCrossoriginPlugin()] : [])],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    base: isElectron ? './' : '/',
    build: {
      outDir: 'dist',
    },
  };
});
