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
import PrenotazioneOnline from './pages/PrenotazioneOnline.tsx';
import { AuthProvider } from './lib/AuthContext.tsx';
import { startAutoBackupWatcher, startAutoFichesWatcher } from './pages/Impostazioni.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isRegistrazione =
  window.location.pathname === '/registrazione' ||
  window.location.hash === '#/registrazione' ||
  window.location.hash.startsWith('#/registrazione?') ||
  params.get('registrazione') === '1';

const isPrenotazione =
  window.location.pathname === '/prenota' ||
  window.location.hash === '#/prenota' ||
  window.location.hash.startsWith('#/prenota?') ||
  params.get('prenota') === '1';

const prenotaUserId = params.get('uid') ?? window.location.hash.match(/[?&]uid=([^&]+)/)?.[1] ?? '';

if (!isRegistrazione && !isPrenotazione) {
  startAutoBackupWatcher();
  startAutoFichesWatcher();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRegistrazione ? (
      <RegistrazioneCliente />
    ) : isPrenotazione ? (
      <PrenotazioneOnline userId={prenotaUserId} />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>
);
