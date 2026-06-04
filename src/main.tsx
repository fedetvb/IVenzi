import { StrictMode } from 'react';
import { initOfflineFetch } from './lib/offlineFetch';

// Must be called before any Supabase fetch happens
initOfflineFetch();

// Registrazione Service Worker per PWA
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker non disponibile, l'app funziona comunque
    });
  });
}
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import RegistrazioneCliente from './pages/RegistrazioneCliente.tsx';
import { AuthProvider } from './lib/AuthContext.tsx';
import { startAutoBackupWatcher } from './pages/Impostazioni.tsx';
import './index.css';

const isRegistrazione =
  window.location.pathname === '/registrazione' ||
  window.location.hash === '#/registrazione' ||
  window.location.hash.startsWith('#/registrazione?');

if (!isRegistrazione) {
  startAutoBackupWatcher();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRegistrazione ? (
      <RegistrazioneCliente />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>
);
