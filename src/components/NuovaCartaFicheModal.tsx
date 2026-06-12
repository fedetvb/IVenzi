import { useEffect, useState } from 'react';
import { X, CreditCard, Gift, Copy, Check, Plus } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { dbInsert, dbSelect } from '../lib/localDb';
import { localDateStr } from '../lib/supabase';

interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono?: string;
}

interface ProdottoCatalogo {
  id: string;
  nome: string;
  marca?: string;
  prezzo_vendita: number;
}

type TipoCarta = 'carta_premium' | 'gift_pass';

export interface CartaFicheResult {
  tipo: TipoCarta;
  codice: string;
  importo: number;
  recordId: string;
}

interface Props {
  onClose: () => void;
  onSaved: (result: CartaFicheResult) => void;
  clienteId: string | null;
  clienteNome: string;
}

function genCodice(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code.slice(0, 4)}-${code.slice(4)}`;
}

function genCodiceGift(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function calcolaPrezzoRicarica(credito: number): number {
  return Math.floor(credito * (250 / 300) / 10) * 10;
}

const IMPORTI_PREMIUM = [50, 100, 150, 200, 300, 400, 500];
const IMPORTI_GIFT = [25, 50, 75, 100, 150, 200];

export default function NuovaCartaFicheModal({ onClose, onSaved, clienteId, clienteNome }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TipoCarta>('carta_premium');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Carta Premium
  const [codicePremium] = useState(() => genCodice('PREMIUM'));
  const [importoCredit, setImportoCredit] = useState(100);
  const [importoCustom, setImportoCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [notePremium, setNotePremium] = useState('');

  // Gift Pass
  const [codiceGift] = useState(() => genCodiceGift());
  const [tipoGift, setTipoGift] = useState<'valore' | 'prodotto'>('valore');
  const [valoreEuro, setValoreEuro] = useState(50);
  const [valoreCustom, setValoreCustom] = useState('');
  const [useValoreCustom, setUseValoreCustom] = useState(false);
  const [prodottoId, setProdottoId] = useState('');
  const [prodotti, setProdotti] = useState<ProdottoCatalogo[]>([]);
  const [occasione, setOccasione] = useState<'invito' | 'compleanno' | 'regalo'>('invito');
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [destinatariaId, setDestinatariaId] = useState('');
  const [destinatariaNome, setDestinatariaNome] = useState('');
  const [destinatariaTelefono, setDestinatariaTelefono] = useState('');
  const [noteGift, setNoteGift] = useState('');

  useEffect(() => {
    dbSelect({ table: 'clienti', filters: [{ col: 'deleted_at', op: 'is_null' }], orderBy: [{ col: 'cognome', asc: true }, { col: 'nome', asc: true }] })
      .then(({ data }) => setClienti((data || []) as Cliente[]));
    dbSelect({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] })
      .then(({ data }) => setProdotti((data || []) as ProdottoCatalogo[]));
  }, []);

  const importoPremium = useCustom ? (parseFloat(importoCustom) || 0) : importoCredit;
  const prezzoCliente = importoPremium > 0 ? calcolaPrezzoRicarica(importoPremium) : 0;

  const prodottoSel = prodotti.find(p => p.id === prodottoId);
  const importoGift = tipoGift === 'prodotto'
    ? (prodottoSel?.prezzo_vendita ?? 0)
    : (useValoreCustom ? (parseFloat(valoreCustom) || 0) : valoreEuro);

  const canSavePremium = !!clienteId && importoPremium > 0;
  const canSaveGift = tipoGift === 'valore' ? importoGift > 0 : !!prodottoId;

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function savePremium() {
    if (!canSavePremium || !clienteId) return;
    setSaving(true);
    const { data } = await dbInsert({ table: 'carte_premium', data: {
      codice: codicePremium,
      cliente_id: clienteId,
      saldo: importoPremium,
      note: notePremium.trim(),
      user_id: user?.id,
    }});
    const cartaId = (data as any)?.id ?? '';
    if (cartaId) {
      await dbInsert({ table: 'ricariche_carta_premium', data: {
        carta_premium_id: cartaId,
        importo: importoPremium,
        note: 'Carica iniziale',
        tipo_ricarica: 'standard',
        user_id: user?.id,
      }});
    }
    setSaving(false);
    onSaved({ tipo: 'carta_premium', codice: codicePremium, importo: prezzoCliente, recordId: cartaId });
  }

  async function saveGift() {
    if (!canSaveGift) return;
    setSaving(true);
    const destClienteSel = clienti.find(c => c.id === destinatariaId);
    const nomeFinale = destinatariaId
      ? `${destClienteSel?.nome ?? ''} ${destClienteSel?.cognome ?? ''}`.trim()
      : destinatariaNome.trim();
    const telFinale = destinatariaId ? (destClienteSel?.telefono ?? '') : destinatariaTelefono.trim();

    const { data } = await dbInsert({ table: 'gift_pass', data: {
      codice: codiceGift,
      tipo: tipoGift,
      valore_euro: tipoGift === 'valore' ? importoGift : null,
      prodotto_id: tipoGift === 'prodotto' ? prodottoId : null,
      prodotto_nome: tipoGift === 'prodotto' && prodottoSel
        ? `${prodottoSel.nome}${prodottoSel.marca ? ` (${prodottoSel.marca})` : ''}`
        : null,
      occasione,
      scadenza_ritiro_giorni: 30,
      scadenza_uso_giorni: 60,
      destinataria_nome: nomeFinale,
      destinataria_telefono: telFinale,
      destinataria_cliente_id: destinatariaId || null,
      cliente_id: clienteId,
      nominativa: false,
      note: noteGift.trim(),
      utilizzata: false,
      attiva: true,
      data_riferimento: localDateStr(),
      user_id: user?.id,
    }});
    const giftPassId = (data as any)?.id ?? '';
    setSaving(false);
    onSaved({ tipo: 'gift_pass', codice: codiceGift, importo: importoGift, recordId: giftPassId });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
              <CreditCard size={15} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Nuova carta</p>
              <p className="text-xs text-stone-400">verrà aggiunta a questa fiche</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-5 gap-1 pt-3">
          {([['carta_premium', 'Carta Premium', CreditCard], ['gift_pass', 'Gift Pass', Gift]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              onClick={() => setTab(val)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === val ? 'border-teal-500 text-teal-700' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ─── CARTA PREMIUM ─── */}
          {tab === 'carta_premium' && (
            <>
              {!clienteId && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  Fiche senza cliente associato. Associa un cliente per creare una carta premium.
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Codice carta</p>
                <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-200">
                  <span className="text-sm font-mono font-medium text-stone-700 flex-1">{codicePremium}</span>
                  <button onClick={() => copyCode(codicePremium)} className="p-1 rounded-md hover:bg-stone-200 transition-colors">
                    {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-stone-400" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Cliente</p>
                <div className="bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-200">
                  <p className="text-sm text-stone-700 font-medium">{clienteNome || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Credito da caricare</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {IMPORTI_PREMIUM.map(imp => (
                    <button
                      key={imp}
                      onClick={() => { setImportoCredit(imp); setUseCustom(false); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!useCustom && importoCredit === imp ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300 hover:bg-teal-50'}`}
                    >
                      €{imp}
                    </button>
                  ))}
                  <button
                    onClick={() => setUseCustom(true)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${useCustom ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300 hover:bg-teal-50'}`}
                  >
                    Altro
                  </button>
                </div>
                {useCustom && (
                  <input
                    type="number"
                    placeholder="Importo credito (€)"
                    value={importoCustom}
                    onChange={e => setImportoCustom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                )}
              </div>

              {importoPremium > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-teal-700">
                    <span>Credito carta</span>
                    <span className="font-semibold">€{importoPremium}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-teal-900 border-t border-teal-200 pt-1.5">
                    <span>Importo addebitato in fiche</span>
                    <span>€{prezzoCliente}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Note (opzionale)</p>
                <input
                  type="text"
                  placeholder="Note sulla carta..."
                  value={notePremium}
                  onChange={e => setNotePremium(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </>
          )}

          {/* ─── GIFT PASS ─── */}
          {tab === 'gift_pass' && (
            <>
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Codice gift pass</p>
                <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-200">
                  <span className="text-lg font-mono font-bold text-stone-700 flex-1 tracking-widest">{codiceGift}</span>
                  <button onClick={() => copyCode(codiceGift)} className="p-1 rounded-md hover:bg-stone-200 transition-colors">
                    {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-stone-400" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Tipo</p>
                <div className="flex gap-2">
                  {(['valore', 'prodotto'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTipoGift(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${tipoGift === t ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300'}`}
                    >
                      {t === 'valore' ? 'Valore in €' : 'Prodotto specifico'}
                    </button>
                  ))}
                </div>
              </div>

              {tipoGift === 'valore' && (
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Valore</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {IMPORTI_GIFT.map(v => (
                      <button
                        key={v}
                        onClick={() => { setValoreEuro(v); setUseValoreCustom(false); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!useValoreCustom && valoreEuro === v ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300 hover:bg-teal-50'}`}
                      >
                        €{v}
                      </button>
                    ))}
                    <button
                      onClick={() => setUseValoreCustom(true)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${useValoreCustom ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300 hover:bg-teal-50'}`}
                    >
                      Altro
                    </button>
                  </div>
                  {useValoreCustom && (
                    <input
                      type="number"
                      placeholder="Valore (€)"
                      value={valoreCustom}
                      onChange={e => setValoreCustom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  )}
                </div>
              )}

              {tipoGift === 'prodotto' && (
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Prodotto</p>
                  {prodotti.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">Nessun prodotto nel catalogo</p>
                  ) : (
                    <select
                      value={prodottoId}
                      onChange={e => setProdottoId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    >
                      <option value="">Seleziona prodotto…</option>
                      {prodotti.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}{p.marca ? ` (${p.marca})` : ''} — €{p.prezzo_vendita}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Occasione</p>
                <div className="flex gap-2">
                  {([['invito', 'Invito'], ['compleanno', 'Compleanno'], ['regalo', 'Regalo']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setOccasione(val)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all ${occasione === val ? 'bg-teal-500 border-teal-500 text-white' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-teal-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Destinataria (opzionale)</p>
                <select
                  value={destinatariaId}
                  onChange={e => { setDestinatariaId(e.target.value); if (e.target.value) { setDestinatariaNome(''); setDestinatariaTelefono(''); } }}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white mb-2"
                >
                  <option value="">Nessuna / nuova…</option>
                  {clienti.map(c => (
                    <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>
                  ))}
                </select>
                {!destinatariaId && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome destinataria"
                      value={destinatariaNome}
                      onChange={e => setDestinatariaNome(e.target.value)}
                      className="px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <input
                      type="tel"
                      placeholder="Telefono"
                      value={destinatariaTelefono}
                      onChange={e => setDestinatariaTelefono(e.target.value)}
                      className="px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                )}
              </div>

              {importoGift > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                  <div className="flex justify-between text-xs font-bold text-teal-900">
                    <span>Importo addebitato in fiche</span>
                    <span>€{importoGift}</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Note (opzionale)</p>
                <input
                  type="text"
                  placeholder="Note sul gift pass..."
                  value={noteGift}
                  onChange={e => setNoteGift(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5 pt-2 border-t border-stone-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={tab === 'carta_premium' ? savePremium : saveGift}
            disabled={saving || (tab === 'carta_premium' ? !canSavePremium : !canSaveGift)}
            className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Plus size={13} />
            {saving ? 'Salvataggio…' : 'Crea e aggiungi'}
          </button>
        </div>
      </div>
    </div>
  );
}
