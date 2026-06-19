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

// Supporta anche hash con query string: #/prenota?uid=... oppure #prenota?uid=...
// e il caso Bolt preview dove l'hash contiene l'intera URL (es: #prenota=1&uid=...)
const hashRaw = window.location.hash.replace(/^#\/?/, '');
const hashParams = new URLSearchParams(hashRaw.includes('?') ? hashRaw.split('?')[1] : (hashRaw.includes('=') ? hashRaw : ''));
const hashPath = hashRaw.split('?')[0];

const isRegistrazione =
  window.location.pathname === '/registrazione' ||
  hashPath === 'registrazione' ||
  params.get('registrazione') === '1' ||
  hashParams.get('registrazione') === '1';

const isPrenotazione =
  window.location.pathname === '/prenota' ||
  hashPath === 'prenota' ||
  params.get('prenota') === '1' ||
  hashParams.get('prenota') === '1';

const SALON_OWNER_ID = 'fc9daf6c-ce30-4941-a8ca-18d99e5e9cc3';

const prenotaUserId =
  params.get('uid') ??
  hashParams.get('uid') ??
  window.location.hash.match(/[?&]uid=([^&]+)/)?.[1] ??
  SALON_OWNER_ID;

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
