import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Quando buildato per Electron, i path devono essere relativi
  base: process.env.ELECTRON === 'true' ? './' : '/',
  build: {
    // Output nella cartella dist (electron/main.js la carica da lì)
    outDir: 'dist',
  },
});