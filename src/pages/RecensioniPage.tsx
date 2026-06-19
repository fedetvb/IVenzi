import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GOOGLE_REVIEW_TESTO_DEFAULT = `Il tuo nuovo look ti fa risplendere? ✨

Se oggi uscendo dal salone ti sei sentita al top (o hai notato sguardi d'invidia specchiandoti nelle vetrine!), dedica 30 secondi a dircelo con una recensione su Google.

Non lo chiediamo per vantarci (okay, forse solo un pochino!), ma perché il tuo passaparola digitale è il motore che ci permette di far crescere il salone e migliorare ogni giorno per te.

Inquadra il QR o clicca qui sotto: le tue 5 stelle sono il nostro premio più bello! ⭐`;

const GOOGLE_SVG = (
  <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface SalonData {
  googleLink: string;
  testo: string;
  logoUrl: string;
  nomeSalone: string;
}

export default function RecensioniPage({ userId }: { userId: string }) {
  const [data, setData] = useState<SalonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const keys = ['link_recensioni_google', 'testo_recensioni_google', 'logo_recensioni_google_url', 'nome_salone'];
    supabase
      .from('impostazioni')
      .select('chiave,valore')
      .eq('user_id', userId)
      .in('chiave', keys)
      .then(({ data: rows }) => {
        const map: Record<string, string> = {};
        for (const r of (rows ?? []) as { chiave: string; valore: string }[]) {
          map[r.chiave] = r.valore;
        }
        setData({
          googleLink: map['link_recensioni_google'] ?? '',
          testo: map['testo_recensioni_google'] || GOOGLE_REVIEW_TESTO_DEFAULT,
          logoUrl: map['logo_recensioni_google_url'] ?? '',
          nomeSalone: map['nome_salone'] ?? '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.googleLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">{GOOGLE_SVG}</div>
          <p className="text-stone-600 font-semibold">Pagina recensioni non configurata</p>
          <p className="text-stone-400 text-sm">Il salone non ha ancora impostato il link delle recensioni Google.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-stone-50 flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo + Google icon */}
        <div className="flex flex-col items-center gap-4">
          {data.logoUrl ? (
            <div className="w-20 h-20 rounded-2xl border border-stone-200 shadow-sm overflow-hidden bg-white flex items-center justify-center">
              <img src={data.logoUrl} alt={data.nomeSalone || 'Logo salone'} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
              {GOOGLE_SVG}
            </div>
          )}
          {data.logoUrl && (
            <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 shadow-sm flex items-center justify-center">
              {GOOGLE_SVG}
            </div>
          )}
          {data.nomeSalone && (
            <p className="text-base font-bold text-stone-800 text-center">{data.nomeSalone}</p>
          )}
        </div>

        {/* Stars */}
        <div className="text-center space-y-2">
          <p className="text-3xl tracking-widest">⭐⭐⭐⭐⭐</p>
          <h1 className="text-xl font-bold text-stone-800">Lascia una recensione!</h1>
        </div>

        {/* Incentive text */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{data.testo}</p>
        </div>

        {/* CTA button */}
        <a
          href={data.googleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white border-2 border-stone-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl shadow-sm transition-all active:scale-95 group"
        >
          <div className="flex-shrink-0">{GOOGLE_SVG}</div>
          <div className="text-left">
            <p className="text-sm font-bold text-stone-800 group-hover:text-blue-700 transition-colors">Recensisci su Google</p>
            <p className="text-xs text-stone-400">Tocca per aprire Google Maps</p>
          </div>
        </a>

        {/* Footer */}
        <p className="text-xs text-stone-300 text-center pt-2">Grazie di cuore per il tuo tempo e il tuo supporto</p>
      </div>
    </div>
  );
}
