import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: process.env.ELECTRON ? './' : '/',
  build: {
    outDir: 'dist',
  },
}));
