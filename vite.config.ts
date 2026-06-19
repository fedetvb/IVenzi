import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

const CORRECT_PROJECT_ID = 'qfpeffzdszdanebmgafb';
const CORRECT_URL = `https://${CORRECT_PROJECT_ID}.supabase.co`;
const CORRECT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcGVmZnpkc3pkYW5lYm1nYWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjI4MDUsImV4cCI6MjA5NTAzODgwNX0.RQ77EhEJxVN02WQWUH9XiBUvRMysxgBVFQSi1UlqhKM';
const CORRECT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcGVmZnpkc3pkYW5lYm1nYWZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ2MjgwNSwiZXhwIjoyMDk1MDM4ODA1fQ.PVi6U7YoZAV7EYVQNZXSSZPUQtg8_NLHSQK3T2eDCIQ';

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

function customPwaIconsPlugin(): Plugin {
  return {
    name: 'custom-pwa-icons',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const customIcon = path.resolve(__dirname, 'public', 'icons', 'photo_2026-06-18_21-21-29.jpg');
      if (!fs.existsSync(distDir) || !fs.existsSync(customIcon)) return;
      const iconTargets = [
        'icons/icon-72x72.png',
        'icons/icon-96x96.png',
        'icons/icon-128x128.png',
        'icons/icon-144x144.png',
        'icons/icon-152x152.png',
        'icons/icon-192x192.png',
        'icons/icon-384x384.png',
        'icons/icon-512x512.png',
      ];
      for (const target of iconTargets) {
        try {
          const destPath = path.join(distDir, target);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(customIcon, destPath);
        } catch { /* skip */ }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isElectron = !!process.env.ELECTRON;
  const buildMode = process.env.BUILD_MODE || 'owner';

  // Repair .env on disk so MCP tools and service-role operations stay correct
  const envPath = path.resolve(__dirname, '.env');
  try {
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf-8'); } catch { /* ignore */ }
    if (!content.includes(CORRECT_PROJECT_ID) ||
        !content.includes('SUPABASE_SERVICE_ROLE_KEY=' + CORRECT_SERVICE_KEY)) {
      const kept = content.split('\n').filter(l => {
        const k = l.split('=')[0];
        return k !== 'VITE_SUPABASE_URL' && k !== 'VITE_SUPABASE_ANON_KEY' && k !== 'SUPABASE_SERVICE_ROLE_KEY';
      });
      kept.push(`VITE_SUPABASE_URL=${CORRECT_URL}`);
      kept.push(`VITE_SUPABASE_ANON_KEY=${CORRECT_ANON_KEY}`);
      kept.push(`SUPABASE_SERVICE_ROLE_KEY=${CORRECT_SERVICE_KEY}`);
      fs.writeFileSync(envPath, kept.join('\n').replace(/\n+/g, '\n').trimEnd() + '\n', 'utf-8');
      console.log('\x1b[32m[enforce-supabase-env] .env riparato → progetto corretto\x1b[0m');
    }
  } catch { /* non-blocking */ }

  return {
    plugins: [
      react(),
      ...(isElectron ? [removeCrossoriginPlugin()] : []),
      safePublicCopyPlugin(),
      customPwaIconsPlugin(),
    ],
    optimizeDeps: { exclude: ['lucide-react'] },
    base: isElectron ? './' : '/',
    define: {
      'import.meta.env.VITE_BUILD_MODE': JSON.stringify(buildMode),
      // Hard-override: always inject the correct Supabase project into the bundle
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(CORRECT_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(CORRECT_ANON_KEY),
    },
    build: {
      outDir: 'dist',
      copyPublicDir: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          prenota: path.resolve(__dirname, 'prenota.html'),
          recensioni: path.resolve(__dirname, 'recensioni.html'),
        },
      },
    },
  };
});
