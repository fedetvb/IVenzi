import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { analizzaVoci, getTestoKey, getDefaultTesto } from '../lib/recensioniUtils';

const GOOGLE_SVG = (
  <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface PageData {
  userId: string;
  clienteId: string | null;
  googleLink: string;
  testo: string;
  logoUrl: string;
  nomeSalone: string;
  recensioneLasciata: boolean;
  bloccataFino: Date | null;
}

async function loadByClienteId(clienteId: string): Promise<PageData | null> {
  const { data, error } = await supabase.rpc('get_recensione_page_data', { p_cliente_id: clienteId });
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  if (d.errore) return null;

  const userId = d.user_id as string;
  const voci = (d.voci as { nome_voce: string }[] | null) ?? [];
  const { categoria, hasTaglio } = analizzaVoci(voci);
  const key = getTestoKey(categoria, hasTaglio);

  // Try user-specific text variant
  let testo = getDefaultTesto(categoria, hasTaglio);
  const { data: variante } = await supabase
    .from('testi_recensioni_dinamici')
    .select('testo_completo')
    .eq('user_id', userId)
    .eq('categoria_principale', categoria)
    .eq('has_taglio', hasTaglio)
    .maybeSingle();
  if (variante?.testo_completo) testo = variante.testo_completo;

  const bloccataFino = d.data_blocco_recensione
    ? new Date(d.data_blocco_recensione as string)
    : null;

  void key; // used only for lookup above

  return {
    userId,
    clienteId,
    googleLink: (d.google_link as string) || '',
    testo,
    logoUrl: (d.logo_url as string) || '',
    nomeSalone: (d.nome_salone as string) || '',
    recensioneLasciata: (d.recensione_lasciata as boolean) ?? false,
    bloccataFino,
  };
}

async function loadBySalonUserId(userId: string): Promise<PageData | null> {
  const keys = ['link_recensioni_google', 'testo_recensioni_google', 'logo_recensioni_google_url', 'nome_salone'];
  const { data: rows } = await supabase
    .from('impostazioni')
    .select('chiave,valore')
    .eq('user_id', userId)
    .in('chiave', keys);
  const map: Record<string, string> = {};
  for (const r of (rows ?? []) as { chiave: string; valore: string }[]) {
    map[r.chiave] = r.valore;
  }
  return {
    userId,
    clienteId: null,
    googleLink: map['link_recensioni_google'] ?? '',
    testo: map['testo_recensioni_google'] || getDefaultTesto('default', false),
    logoUrl: map['logo_recensioni_google_url'] ?? '',
    nomeSalone: map['nome_salone'] ?? '',
    recensioneLasciata: false,
    bloccataFino: null,
  };
}

export default function RecensioniPage({ userId, clienteId }: { userId: string; clienteId?: string | null }) {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (clienteId) {
          const d = await loadByClienteId(clienteId);
          setData(d);
          // La cliente ha APERTO la pagina: imposta blocco 365 giorni
          // (se non ha già recensito e non è già in un blocco attivo)
          if (d && !d.recensioneLasciata && (!d.bloccataFino || d.bloccataFino <= new Date())) {
            await supabase.rpc('segna_visualizzazione_recensione', { p_cliente_id: clienteId });
          }
        } else if (userId) {
          const d = await loadBySalonUserId(userId);
          setData(d);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, clienteId]);

  async function handleGoogleClick() {
    if (data?.clienteId && !data.recensioneLasciata) {
      await supabase.rpc('segna_recensione_lasciata', { p_cliente_id: data.clienteId });
      setClicked(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
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

  // Blocco per già recensita
  if (data.recensioneLasciata) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-stone-50 px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⭐⭐⭐⭐⭐</div>
          <h2 className="text-xl font-bold text-stone-800">Grazie di cuore!</h2>
          <p className="text-stone-500 text-sm leading-relaxed">Hai già lasciato la tua preziosa recensione. Sei fantastica!</p>
          {data.logoUrl && (
            <img src={data.logoUrl} alt={data.nomeSalone} className="w-16 h-16 rounded-2xl object-cover mx-auto border border-stone-200" />
          )}
          {data.nomeSalone && <p className="text-xs text-stone-400">{data.nomeSalone}</p>}
        </div>
      </div>
    );
  }

  // Blocco cortesia (inviato da meno di 1 anno, non ha recensito)
  if (data.bloccataFino && data.bloccataFino > new Date() && !clicked) {
    const giorni = Math.ceil((data.bloccataFino.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-stone-50 px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">{GOOGLE_SVG}</div>
          <h2 className="text-lg font-bold text-stone-800">Ci rivediamo tra poco!</h2>
          <p className="text-stone-500 text-sm leading-relaxed">
            Abbiamo già pensato a te di recente. Ripasserai tra circa {giorni} {giorni === 1 ? 'giorno' : 'giorni'}.
          </p>
          {data.nomeSalone && <p className="text-xs text-stone-400">{data.nomeSalone}</p>}
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
          onClick={handleGoogleClick}
          className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white border-2 border-stone-200 hover:border-blue-400 hover:bg-blue-50 rounded-2xl shadow-sm transition-all active:scale-95 group"
        >
          <div className="flex-shrink-0">{GOOGLE_SVG}</div>
          <div className="text-left">
            <p className="text-sm font-bold text-stone-800 group-hover:text-blue-700 transition-colors">Recensisci su Google</p>
            <p className="text-xs text-stone-400">Tocca per aprire Google Maps</p>
          </div>
        </a>

        <p className="text-xs text-stone-300 text-center pt-2">Grazie di cuore per il tuo tempo e il tuo supporto</p>
      </div>
    </div>
  );
}
