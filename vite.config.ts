import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function removeCrossoriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

function safePublicCopyPlugin(): Plugin {
  return {
    name: 'safe-public-copy',
    closeBundle() {
      const publicDir = path.resolve(__dirname, 'public');
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) return;
      function copyDir(src: string, dest: string) {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          try {
            if (entry.isDirectory()) {
              fs.mkdirSync(destPath, { recursive: true });
              copyDir(srcPath, destPath);
            } else if (!fs.existsSync(destPath)) {
              fs.copyFileSync(srcPath, destPath);
            }
          } catch { /* skip locked files */ }
        }
      }
      copyDir(publicDir, distDir);
    },
  };
}

export default defineConfig(({ mode }) => {
  const isElectron = !!process.env.ELECTRON;
  const buildMode = process.env.BUILD_MODE || 'owner';
  return {
    plugins: [
      react(),
      ...(isElectron ? [removeCrossoriginPlugin()] : []),
      safePublicCopyPlugin(),
    ],
    optimizeDeps: { exclude: ['lucide-react'] },
    base: isElectron ? './' : '/',
    define: {
      'import.meta.env.VITE_BUILD_MODE': JSON.stringify(buildMode),
    },
    build: {
      outDir: 'dist',
      copyPublicDir: false,
    },
  };
});
