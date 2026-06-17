import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Plus, Trash2, X, ChevronDown, Search, Tag, Star,
  RefreshCw, Check, Copy, AlertCircle, Wallet, History, Percent, Euro,
  Gift, Package, Send, Clock, ShieldCheck, List, Pencil, ChevronRight, BookOpen,
} from 'lucide-react';
import { localDateStr, supabase } from '../lib/supabase';
import PasswordGateModal from '../components/PasswordGateModal';
import SmsCartaModal, { type AzioneCarta } from '../components/SmsCartaModal';
import { useAuth } from '../lib/AuthContext';
import { dbSelect, dbSelectWithRelated, dbInsert, dbUpdate, dbDelete, getImpostazione, invalidateTableCache } from '../lib/localDb';
import { apriWhatsApp, applyWaTemplate, DEFAULT_WA_GP_SALONE, DEFAULT_WA_GP_CLIENTE } from '../lib/waUtils';

type TipoPagamento = 'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartaSconto {
  id: string;
  codice: string;
  descrizione: string;
  tipo_sconto: 'percentuale' | 'fisso' | 'listino';
  valore_sconto: number;
  attiva: boolean;
  usa_e_getta: boolean;
  nominativa: boolean;
  cliente_id: string | null;
  telefono_override: string;
  listino_categoria_id: string | null;
  created_at: string;
  clienti?: { nome: string; cognome: string; telefono: string } | null;
}

interface CartaPremium {
  id: string;
  codice: string;
  cliente_id: string;
  saldo: number;
  note: string;
  attiva: boolean;
  created_at: string;
  clienti?: { nome: string; cognome: string; telefono: string } | null;
}

interface RicaricaPremium {
  id: string;
  carta_premium_id: string;
  importo: number;
  note: string;
  tipo_ricarica?: string;
  created_at: string;
}

interface UtilizzoCarta {
  id: string;
  importo_originale?: number;
  sconto_applicato?: number;
  importo_finale?: number;
  importo_detratto?: number;
  created_at: string;
  fiches?: { appuntamenti?: { data_ora: string } | null } | null;
}

interface Cliente { id: string; nome: string; cognome: string; telefono: string; }

interface ListinoCategoria {
  id: string;
  nome: string;
  descrizione: string;
  created_at: string;
}

interface ListinoPrezzoRow {
  id: string;
  categoria_id: string;
  nome_servizio: string;
  prezzo: number;
}

type Tab = 'sconto' | 'premium' | 'gift' | 'listino';

// ─── Utils ────────────────────────────────────────────────────────────────────

function genCodice(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code.slice(0, 4)}-${code.slice(4)}`;
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Prezzo che la cliente paga per ricevere "credito" sulla carta.
// Proporzione base: 300 credito → 250 pagati. Arrotondato per difetto alla decina.
function calcolaPrezzoRicarica(credito: number): number {
  return Math.floor(credito * (250 / 300) / 10) * 10;
}

// ─── Modal Nuova Carta Sconto ─────────────────────────────────────────────────

function NuovaCartaScontoModal({ clienti, onClose, onSaved }: {
  clienti: Cliente[];
  onClose: () => void;
  onSaved: (info: { codice: string; tipoSconto: 'percentuale' | 'fisso' | 'listino'; valoreSconto: number; cliente: Cliente | null; telefonoOverride: string }) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    codice: genCodice('SCONTO'),
    descrizione: '',
    tipo_sconto: 'percentuale' as 'percentuale' | 'fisso' | 'listino',
    valore_sconto: 10,
    usa_e_getta: true,
    cliente_id: '',
    telefono_override: '',
    listino_categoria_id: '',
  });
  const [categorie, setCategorie] = useState<ListinoCategoria[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dbSelect({ table: 'carte_sconto_listino_categorie', orderBy: [{ col: 'nome', asc: true }] }).then(({ data }) => {
      setCategorie((data || []) as ListinoCategoria[]);
    });
  }, []);

  const clienteSelezionato = clienti.find(c => c.id === form.cliente_id) ?? null;
  const clienteHaTelefono = !!clienteSelezionato?.telefono?.trim();
  const mostraTelefonoManuale = !clienteSelezionato || !clienteHaTelefono;
  const isNominativa = !form.usa_e_getta && !!form.cliente_id;

  // Reset listino type if card is no longer nominative
  useEffect(() => {
    if (!isNominativa && form.tipo_sconto === 'listino') {
      setForm(f => ({ ...f, tipo_sconto: 'percentuale', listino_categoria_id: '' }));
    }
  }, [isNominativa, form.tipo_sconto]);

  async function save() {
    if (form.tipo_sconto === 'listino' && !form.listino_categoria_id) return;
    setSaving(true);
    await dbInsert({ table: 'carte_sconto', data: {
      codice: form.codice,
      descrizione: form.descrizione,
      tipo_sconto: form.tipo_sconto,
      valore_sconto: form.tipo_sconto === 'listino' ? 0 : form.valore_sconto,
      usa_e_getta: form.usa_e_getta,
      attiva: true,
      cliente_id: form.cliente_id || null,
      telefono_override: form.telefono_override.trim(),
      nominativa: isNominativa,
      listino_categoria_id: form.tipo_sconto === 'listino' ? form.listino_categoria_id : null,
      user_id: user?.id,
    }});
    setSaving(false);
    onSaved({
      codice: form.codice,
      tipoSconto: form.tipo_sconto,
      valoreSconto: form.valore_sconto,
      cliente: clienteSelezionato,
      telefonoOverride: form.telefono_override.trim(),
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(form.codice).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Tag size={16} className="text-amber-600" />
            </div>
            <h2 className="font-bold text-stone-800">Nuova carta sconto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Codice */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Codice carta</label>
            <div className="flex gap-2">
              <input
                value={form.codice}
                onChange={e => setForm(f => ({ ...f, codice: e.target.value.toUpperCase() }))}
                className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
              />
              <button onClick={() => setForm(f => ({ ...f, codice: genCodice('SCONTO') }))} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors" title="Rigenera">
                <RefreshCw size={14} className="text-stone-500" />
              </button>
              <button onClick={copyCode} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-stone-500" />}
              </button>
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Descrizione</label>
            <input
              value={form.descrizione}
              onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
              placeholder="es. Benvenuto, Compleanno, Promozione..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
            />
          </div>

          {/* Tipo e valore sconto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Tipo sconto</label>
              <select
                value={form.tipo_sconto}
                onChange={e => setForm(f => ({ ...f, tipo_sconto: e.target.value as 'percentuale' | 'fisso' | 'listino' }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="percentuale">Percentuale (%)</option>
                <option value="fisso">Importo fisso (€)</option>
                {isNominativa && <option value="listino">Listino prezzi</option>}
              </select>
            </div>
            {form.tipo_sconto !== 'listino' && (
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                  Valore {form.tipo_sconto === 'percentuale' ? '(%)' : '(€)'}
                </label>
                <input
                  type="number"
                  onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                  min={0}
                  max={form.tipo_sconto === 'percentuale' ? 100 : undefined}
                  step={form.tipo_sconto === 'percentuale' ? 1 : 0.5}
                  value={form.valore_sconto}
                  onChange={e => setForm(f => ({ ...f, valore_sconto: Number(e.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>

          {/* Selezione categoria listino */}
          {form.tipo_sconto === 'listino' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                Categoria listino <span className="text-red-500">*</span>
              </label>
              {categorie.length === 0 ? (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    Nessun listino disponibile. Vai alla scheda <strong>Listini</strong> per crearne uno prima.
                  </p>
                </div>
              ) : (
                <select
                  value={form.listino_categoria_id}
                  onChange={e => setForm(f => ({ ...f, listino_categoria_id: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">— Seleziona listino —</option>
                  {categorie.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}{c.descrizione ? ` · ${c.descrizione}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Assegna a cliente */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Assegna a cliente (opzionale)</label>
            <select
              value={form.cliente_id}
              onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, telefono_override: '' }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            >
              <option value="">— Nessun cliente (generica) —</option>
              {clienti.map(c => (
                <option key={c.id} value={c.id}>{c.nome} {c.cognome}{c.telefono ? '' : ' — senza tel.'}</option>
              ))}
            </select>
          </div>

          {/* Telefono manuale */}
          {mostraTelefonoManuale && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                Numero di telefono
                {!clienteSelezionato
                  ? <span className="ml-1 text-stone-400 normal-case font-normal">(per notifica WhatsApp)</span>
                  : <span className="ml-1 text-amber-600 normal-case font-normal">— scheda senza numero</span>
                }
              </label>
              <input
                type="tel"
                value={form.telefono_override}
                onChange={e => setForm(f => ({ ...f, telefono_override: e.target.value }))}
                placeholder="es. 3331234567"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
              />
            </div>
          )}

          {/* Usa e getta */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
            <div
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.usa_e_getta ? 'bg-amber-500' : 'bg-stone-200'}`}
              onClick={() => setForm(f => ({ ...f, usa_e_getta: !f.usa_e_getta }))}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.usa_e_getta ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">Usa e getta</p>
              <p className="text-xs text-stone-400">La carta si disattiva dopo il primo utilizzo</p>
            </div>
          </label>

          {/* Banner nominativa */}
          {isNominativa && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700">Carta nominativa</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Non essendo usa e getta, la carta sarà riservata esclusivamente a <span className="font-semibold">{clienteSelezionato!.nome} {clienteSelezionato!.cognome}</span>. Non potrà essere usata da altri clienti in cassa.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || !form.codice || (form.tipo_sconto === 'listino' && !form.listino_categoria_id)} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Crea carta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Nuova Carta Premium ────────────────────────────────────────────────

function NuovaCartaPremiumModal({ clienti, onClose, onSaved }: {
  clienti: Cliente[];
  onClose: () => void;
  onSaved: (info: { codice: string; creditoIniziale: number; cliente: Cliente }) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    codice: genCodice('PREMIUM'),
    cliente_id: '',
    importo_iniziale: 100,
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>(null);

  const prezzoCliente = form.importo_iniziale > 0 ? calcolaPrezzoRicarica(form.importo_iniziale) : 0;

  async function save() {
    if (!form.cliente_id) return;
    if (form.importo_iniziale > 0 && !tipoPagamento) return;
    setSaving(true);
    const cliente = clienti.find(c => c.id === form.cliente_id)!;
    const clienteNome = cliente ? `${cliente.nome} ${cliente.cognome}`.trim() : '';
    const { data } = await dbInsert({ table: 'carte_premium', data: {
      codice: form.codice,
      cliente_id: form.cliente_id,
      saldo: form.importo_iniziale,
      attiva: true,
      note: form.note,
      user_id: user?.id,
    }});
    const cartaId = (data as any)?.id;
    if (cartaId && form.importo_iniziale > 0) {
      await dbInsert({ table: 'ricariche_carta_premium', data: {
        carta_premium_id: cartaId,
        importo: form.importo_iniziale,
        importo_pagato: prezzoCliente,
        note: 'Carica iniziale',
        tipo_ricarica: 'standard',
        user_id: user?.id,
      }});
      // Fiche automatica già convalidata
      const ficheRes = await dbInsert({ table: 'fiches', data: {
        cliente_id: form.cliente_id,
        convalidata: true,
        convalidata_at: new Date().toISOString(),
        importo_convalidato: prezzoCliente,
        manuale: true,
        tipo_fiche: 'carta_premium',
        data_riferimento: localDateStr(),
        note: `Carta premium ${form.codice} - carica iniziale`,
        tipo_pagamento: tipoPagamento,
        user_id: user?.id,
      }});
      const ficheId = (ficheRes.data as any)?.id;
      if (ficheId) {
        await dbInsert({ table: 'fiche_voci', data: {
          fiche_id: ficheId,
          tipo: 'servizio',
          nome_voce: `Carta premium ${form.codice}`,
          prezzo: prezzoCliente,
          ordine: 0,
          user_id: user?.id,
        }});
        if (tipoPagamento !== 'contanti_nero' && prezzoCliente > 0) {
          await dbInsert({ table: 'incassi_giornalieri', data: {
            data: localDateStr(),
            fiche_id: ficheId,
            cliente_nome: clienteNome,
            importo: prezzoCliente,
            note: `Carta premium ${form.codice} - carica iniziale`,
            user_id: user?.id,
          }});
        }
      }
    }
    setSaving(false);
    onSaved({ codice: form.codice, creditoIniziale: form.importo_iniziale, cliente });
  }

  function copyCode() {
    navigator.clipboard.writeText(form.codice).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const IMPORTI_RAPIDI = [50, 100, 200, 300, 400, 500];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Star size={16} className="text-emerald-600" />
            </div>
            <h2 className="font-bold text-stone-800">Nuova carta premium</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Codice */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Codice carta</label>
            <div className="flex gap-2">
              <input
                value={form.codice}
                onChange={e => setForm(f => ({ ...f, codice: e.target.value.toUpperCase() }))}
                className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              />
              <button onClick={() => setForm(f => ({ ...f, codice: genCodice('PREMIUM') }))} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                <RefreshCw size={14} className="text-stone-500" />
              </button>
              <button onClick={copyCode} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-stone-500" />}
              </button>
            </div>
          </div>

          {/* Cliente (obbligatorio) */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Intestata a <span className="text-red-500">*</span></label>
            <select
              value={form.cliente_id}
              onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
            >
              <option value="">— Seleziona cliente —</option>
              {clienti.map(c => (
                <option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>
              ))}
            </select>
          </div>

          {/* Importo iniziale */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Carica iniziale (€)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {IMPORTI_RAPIDI.map(imp => (
                <button key={imp} onClick={() => setForm(f => ({ ...f, importo_iniziale: imp }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${form.importo_iniziale === imp ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  €{imp}
                </button>
              ))}
            </div>
            <input
              type="number"
              onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
              min={0}
              step={5}
              value={form.importo_iniziale}
              onChange={e => setForm(f => ({ ...f, importo_iniziale: Number(e.target.value) }))}
              onFocus={e => e.target.select()}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Riepilogo incasso */}
          {form.importo_iniziale > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-800">La cliente paga</span>
                <span className="text-lg font-bold text-amber-700">€{prezzoCliente}</span>
              </div>
              <p className="text-xs text-amber-600 mt-0.5">
                Credito sulla carta: €{form.importo_iniziale} · Incasso registrato: €{prezzoCliente}
              </p>
            </div>
          )}

          {/* Metodo di pagamento */}
          {form.importo_iniziale > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Metodo di pagamento <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setTipoPagamento('cc_bancomat')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'cc_bancomat' ? 'bg-blue-500 text-white border-blue-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <CreditCard size={12} />
                  CC/Bancomat
                </button>
                <button onClick={() => setTipoPagamento('contanti_verde')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_verde' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_verde' ? 'bg-white' : 'bg-emerald-500'}`} />
                  Contanti
                </button>
                <button onClick={() => setTipoPagamento('contanti_nero')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_nero' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_nero' ? 'bg-white' : 'bg-stone-800'}`} />
                  Contanti
                </button>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note</label>
            <input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Note opzionali..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || !form.cliente_id || (form.importo_iniziale > 0 && !tipoPagamento)} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio...' : form.importo_iniziale > 0 && !tipoPagamento ? 'Seleziona pagamento' : `Crea carta · cliente paga €${prezzoCliente}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Ricarica Carta Premium ─────────────────────────────────────────────

function RicaricaModal({ carta, onClose, onSaved }: {
  carta: CartaPremium;
  onClose: () => void;
  onSaved: (info: { importo: number; prezzoCliente: number; nuovoSaldo: number; tipo: string }) => void;
}) {
  const { user } = useAuth();
  const [importo, setImporto] = useState(50);
  const [note, setNote] = useState('');
  const [tipo, setTipo] = useState<'standard' | 'gratuito'>('standard');
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>(null);
  const [saving, setSaving] = useState(false);

  const IMPORTI_RAPIDI = [100, 150, 200, 300, 400, 500];
  const prezzoCliente = tipo === 'standard' ? calcolaPrezzoRicarica(importo) : 0;

  async function save() {
    if (tipo === 'standard' && !tipoPagamento) return;
    setSaving(true);
    const oggi = localDateStr();
    const clienteNome = carta.clienti ? `${carta.clienti.nome} ${carta.clienti.cognome}`.trim() : '';
    await dbInsert({ table: 'ricariche_carta_premium', data: {
      carta_premium_id: carta.id, importo, importo_pagato: tipo === 'standard' ? prezzoCliente : 0, note, tipo_ricarica: tipo, user_id: user?.id,
    }});
    await dbUpdate({ table: 'carte_premium', id: carta.id, data: { saldo: carta.saldo + importo, attiva: true } });
    if (tipo === 'standard') {
      // Fiche automatica già convalidata
      const ficheRes = await dbInsert({ table: 'fiches', data: {
        cliente_id: carta.cliente_id,
        convalidata: true,
        convalidata_at: new Date().toISOString(),
        importo_convalidato: prezzoCliente,
        manuale: true,
        tipo_fiche: 'carta_premium',
        data_riferimento: oggi,
        note: `Ricarica carta premium ${carta.codice}`,
        tipo_pagamento: tipoPagamento,
        user_id: user?.id,
      }});
      const ficheId = (ficheRes.data as any)?.id;
      if (ficheId) {
        await dbInsert({ table: 'fiche_voci', data: {
          fiche_id: ficheId,
          tipo: 'servizio',
          nome_voce: `Ricarica carta premium ${carta.codice}${clienteNome ? ` - ${clienteNome}` : ''}`,
          prezzo: prezzoCliente,
          ordine: 0,
          user_id: user?.id,
        }});
        if (tipoPagamento !== 'contanti_nero' && prezzoCliente > 0) {
          await dbInsert({ table: 'incassi_giornalieri', data: {
            data: oggi,
            fiche_id: ficheId,
            cliente_nome: clienteNome,
            importo: prezzoCliente,
            note: `Ricarica carta premium ${carta.codice}`,
            user_id: user?.id,
          }});
        }
      }
    }
    setSaving(false);
    onSaved({ importo, prezzoCliente, nuovoSaldo: carta.saldo + importo, tipo });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Wallet size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Ricarica carta</p>
              <p className="text-xs text-stone-400">{carta.codice}{carta.clienti ? ` · ${carta.clienti.nome} ${carta.clienti.cognome}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Tipo ricarica */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTipo('standard')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'standard' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Wallet size={14} />
              Ricarica standard
            </button>
            <button onClick={() => setTipo('gratuito')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'gratuito' ? 'bg-sky-500 text-white border-sky-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Plus size={14} />
              Credito extra gratuito
            </button>
          </div>
          {tipo === 'gratuito' && (
            <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
              Credito bonus: nessun incasso registrato e nessuna detrazione applicata.
            </p>
          )}
          {tipo === 'standard' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Metodo di pagamento <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setTipoPagamento('cc_bancomat')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'cc_bancomat' ? 'bg-blue-500 text-white border-blue-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <CreditCard size={12} />
                  CC/Bancomat
                </button>
                <button onClick={() => setTipoPagamento('contanti_verde')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_verde' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_verde' ? 'bg-white' : 'bg-emerald-500'}`} />
                  Contanti
                </button>
                <button onClick={() => setTipoPagamento('contanti_nero')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_nero' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_nero' ? 'bg-white' : 'bg-stone-800'}`} />
                  Contanti
                </button>
              </div>
            </div>
          )}
          <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700 font-medium">Saldo attuale</span>
            <span className="text-lg font-bold text-emerald-700">€{fmt(carta.saldo)}</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Credito da aggiungere alla carta (€)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {IMPORTI_RAPIDI.map(imp => (
                <button key={imp} onClick={() => setImporto(imp)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${importo === imp ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  +€{imp}
                </button>
              ))}
            </div>
            <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={1} step={10} value={importo} onChange={e => setImporto(Number(e.target.value))}
              onFocus={e => e.target.select()}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div className="space-y-1.5">
            <div className="bg-stone-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-stone-600">Nuovo saldo carta</span>
              <span className="text-lg font-bold text-stone-800">€{fmt(carta.saldo + importo)}</span>
            </div>
            {tipo === 'standard' && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700 font-medium">La cliente paga</span>
                  <span className="text-xl font-bold text-amber-700">€{prezzoCliente}</span>
                </div>
                <p className="text-xs text-amber-500 mt-1">Credito sulla carta: €{fmt(importo)} · Incasso registrato: €{prezzoCliente}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivazione ricarica..." className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || importo <= 0 || (tipo === 'standard' && !tipoPagamento)}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${tipo === 'gratuito' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {saving ? 'Ricarica...' : tipo === 'gratuito' ? `Aggiungi credito +€${fmt(importo)}` : tipoPagamento ? `Ricarica · cliente paga €${prezzoCliente}` : 'Seleziona pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Storico Utilizzi ───────────────────────────────────────────────────

function StoricoModal({ titolo, utilizzi, ricariche = [], tipo, onClose }: {
  titolo: string;
  utilizzi: UtilizzoCarta[];
  ricariche?: RicaricaPremium[];
  tipo: 'sconto' | 'premium';
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<'ricariche' | 'detrazioni'>('ricariche');

  const totaleRicariche = ricariche.reduce((s, r) => s + r.importo, 0);
  const totaleDetrazioni = utilizzi.reduce((s, u) => s + (u.importo_detratto ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-stone-500" />
            <h2 className="font-bold text-stone-800">{titolo}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>

        {tipo === 'premium' ? (
          <>
            {/* Sub-tab ricariche / detrazioni */}
            <div className="flex gap-1 bg-stone-50 p-1 mx-4 mt-4 rounded-xl flex-shrink-0">
              <button onClick={() => setSubTab('ricariche')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'ricariche' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                <Wallet size={13} />
                Ricariche
                {ricariche.length > 0 && <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{ricariche.length}</span>}
              </button>
              <button onClick={() => setSubTab('detrazioni')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'detrazioni' ? 'bg-white text-red-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                <ChevronDown size={13} />
                Detrazioni
                {utilizzi.length > 0 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{utilizzi.length}</span>}
              </button>
            </div>

            {/* Totale riepilogo */}
            <div className="grid grid-cols-2 gap-2 px-4 mt-3 flex-shrink-0">
              <div className={`rounded-xl p-2.5 text-center transition-opacity ${subTab === 'ricariche' ? 'bg-emerald-50' : 'bg-stone-50 opacity-60'}`}>
                <p className="text-xs text-stone-500">Tot. ricaricato</p>
                <p className="text-sm font-bold text-emerald-700">+€{fmt(totaleRicariche)}</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center transition-opacity ${subTab === 'detrazioni' ? 'bg-red-50' : 'bg-stone-50 opacity-60'}`}>
                <p className="text-xs text-stone-500">Tot. detratto</p>
                <p className="text-sm font-bold text-red-600">-€{fmt(totaleDetrazioni)}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 mt-2">
              {subTab === 'ricariche' && (
                ricariche.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">Nessuna ricarica registrata</p>
                ) : ricariche.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                    <div>
                      <p className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-sm font-semibold text-stone-800">+€{fmt(r.importo)}</p>
                      {r.note && <p className="text-xs text-stone-400 mt-0.5 italic">{r.note}</p>}
                    </div>
                    <div className="text-right">
                      {r.tipo_ricarica === 'gratuito' ? (
                        <span className="text-[10px] font-bold bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full">Bonus gratuito</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Standard</span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {subTab === 'detrazioni' && (
                utilizzi.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">Nessuna detrazione registrata</p>
                ) : utilizzi.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                    <div>
                      <p className="text-xs text-stone-400">{new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-sm font-semibold text-red-600">-€{fmt(u.importo_detratto ?? 0)}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Utilizzo</span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          // Carta sconto: lista semplice come prima
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {utilizzi.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-8">Nessun utilizzo registrato</p>
            ) : utilizzi.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50">
                <div>
                  <p className="text-xs text-stone-400">{new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p className="text-sm text-stone-700">
                    Originale <span className="font-semibold">€{fmt(u.importo_originale ?? 0)}</span>
                    {' → '} Finale <span className="font-semibold text-emerald-600">€{fmt(u.importo_finale ?? 0)}</span>
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  -{fmt(u.sconto_applicato ?? 0)}€
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carte Sconto Tab ─────────────────────────────────────────────────────────

function CarteSconto({ clienti }: { clienti: Cliente[] }) {
  const [carte, setCarte] = useState<CartaSconto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordGate, setShowPasswordGate] = useState<'nuova' | 'elimina' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroStato, setFiltroStato] = useState<'tutte' | 'attive' | 'disattive'>('tutte');
  const [storicoCarta, setStoricoCarta] = useState<{ carta: CartaSconto; utilizzi: UtilizzoCarta[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [smsModal, setSmsModal] = useState<{ nominativo: string; telefono: string; codice: string; azione: AzioneCarta } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbSelectWithRelated({
      table: 'carte_sconto',
      filters: [{ col: 'deleted_at', op: 'is_null' }],
      orderBy: [{ col: 'created_at', asc: false }],
      relations: [{ key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, cognome, telefono' }],
      supabaseSelect: '*, clienti(nome, cognome, telefono)',
    });
    setCarte((data || []) as CartaSconto[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleAttiva(carta: CartaSconto) {
    await dbUpdate({ table: 'carte_sconto', id: carta.id, data: { attiva: carta.attiva === false } });
    load();
  }

  async function confirmDeleteCarta(id: string) {
    await dbUpdate({ table: 'carte_sconto', id, data: { deleted_at: new Date().toISOString() } });
    setPendingDeleteId(null);
    load();
  }

  function deleteCarta(id: string) {
    setPendingDeleteId(id);
    setShowPasswordGate('elimina');
  }

  async function openStorico(carta: CartaSconto) {
    const { data } = await dbSelect({ table: 'utilizzi_carta_sconto', filters: [{ col: 'carta_sconto_id', op: 'eq', val: carta.id }], orderBy: [{ col: 'created_at', asc: false }] });
    setStoricoCarta({ carta, utilizzi: (data || []) as UtilizzoCarta[] });
  }

  function copyCodice(codice: string) {
    navigator.clipboard.writeText(codice).catch(() => {});
    setCopied(codice);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = carte.filter(c => {
    const matchSearch = !search || c.codice.toLowerCase().includes(search.toLowerCase()) ||
      c.descrizione.toLowerCase().includes(search.toLowerCase()) ||
      (c.clienti && `${c.clienti.nome} ${c.clienti.cognome}`.toLowerCase().includes(search.toLowerCase()));
    const matchStato = filtroStato === 'tutte' || (filtroStato === 'attive' ? c.attiva !== false : c.attiva === false);
    return matchSearch && matchStato;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Barra azioni */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per codice, descrizione o cliente..."
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 bg-white" />
        </div>
        <div className="flex gap-2">
          {(['tutte', 'attive', 'disattive'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${filtroStato === s ? 'bg-amber-500 text-white border-amber-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPasswordGate('nuova')} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0">
          <Plus size={15} />
          Nuova carta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Totale carte', value: carte.length, color: 'text-stone-700' },
          { label: 'Attive', value: carte.filter(c => c.attiva !== false).length, color: 'text-emerald-600' },
          { label: 'Disattive', value: carte.filter(c => c.attiva === false).length, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista carte */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Tag size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Nessuna carta trovata</p>
          <p className="text-xs text-stone-400 mt-1">Crea la prima carta sconto per iniziare</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(carta => {
            const isUsaGetta = carta.usa_e_getta;
            const accentActive = isUsaGetta ? 'bg-rose-50 border-rose-200' : 'bg-teal-50 border-teal-200';
            const accentInactive = 'border-stone-100 opacity-60';
            const iconBg = isUsaGetta
              ? (carta.attiva !== false ? 'bg-rose-100' : 'bg-stone-100')
              : (carta.attiva !== false ? 'bg-teal-100' : 'bg-stone-100');
            const iconColor = isUsaGetta
              ? (carta.attiva !== false ? 'text-rose-600' : 'text-stone-400')
              : (carta.attiva !== false ? 'text-teal-600' : 'text-stone-400');
            const scontoColor = isUsaGetta
              ? (carta.attiva !== false ? 'text-rose-600' : 'text-stone-400')
              : (carta.attiva !== false ? 'text-teal-600' : 'text-stone-400');

            return (
              <div key={carta.id} className={`rounded-2xl border p-4 transition-all ${carta.attiva !== false ? accentActive : accentInactive}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                      {carta.tipo_sconto === 'percentuale'
                        ? <Percent size={18} className={iconColor} />
                        : carta.tipo_sconto === 'listino'
                        ? <List size={18} className={iconColor} />
                        : <Euro size={18} className={iconColor} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copyCodice(carta.codice)} className="font-mono text-sm font-bold text-stone-800 hover:text-amber-600 transition-colors flex items-center gap-1">
                          {carta.codice}
                          {copied === carta.codice ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="text-stone-300" />}
                        </button>
                        {carta.attiva === false && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Disattiva</span>}
                        {isUsaGetta
                          ? <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-semibold">Usa e getta</span>
                          : <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">Riutilizzabile</span>
                        }
                        {carta.nominativa && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Nominativa</span>}
                        {carta.tipo_sconto === 'listino' && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Listino</span>}
                      </div>
                      {carta.descrizione && <p className="text-xs text-stone-500 mt-0.5">{carta.descrizione}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-sm font-bold ${scontoColor}`}>
                          {carta.tipo_sconto === 'percentuale'
                            ? `${carta.valore_sconto}% di sconto`
                            : carta.tipo_sconto === 'listino'
                            ? 'Prezzi personalizzati'
                            : `€${fmt(carta.valore_sconto)} di sconto`}
                        </span>
                        {carta.clienti
                          ? <span className="text-xs text-stone-500">{carta.clienti.nome} {carta.clienti.cognome}</span>
                          : <span className="text-xs text-stone-400 italic">Generica</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openStorico(carta)} className="p-2 rounded-lg hover:bg-white/70 transition-colors text-stone-400 hover:text-stone-600" title="Storico utilizzi">
                      <History size={15} />
                    </button>
                    <button onClick={() => toggleAttiva(carta)} className={`p-2 rounded-lg transition-colors ${carta.attiva !== false ? 'hover:bg-red-50 text-stone-400 hover:text-red-500' : 'hover:bg-emerald-50 text-stone-400 hover:text-emerald-500'}`} title={carta.attiva !== false ? 'Disattiva' : 'Attiva'}>
                      <AlertCircle size={15} />
                    </button>
                    <button onClick={() => deleteCarta(carta.id)} className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPasswordGate && (
        <PasswordGateModal
          titolo={showPasswordGate === 'nuova' ? 'Nuova carta sconto' : 'Elimina carta sconto'}
          descrizione={showPasswordGate === 'nuova' ? 'Inserisci la password per creare una nuova carta sconto.' : 'Inserisci la password per eliminare questa carta sconto.'}
          onSuccess={() => {
            if (showPasswordGate === 'nuova') { setShowPasswordGate(null); setShowModal(true); }
            else if (pendingDeleteId) { setShowPasswordGate(null); confirmDeleteCarta(pendingDeleteId); }
          }}
          onClose={() => { setShowPasswordGate(null); setPendingDeleteId(null); }}
        />
      )}
      {showModal && (
        <NuovaCartaScontoModal
          clienti={clienti}
          onClose={() => setShowModal(false)}
          onSaved={({ codice, tipoSconto, valoreSconto, cliente, telefonoOverride }) => {
            setShowModal(false);
            load();
            const telefono = cliente?.telefono?.trim() || telefonoOverride;
            const nominativo = cliente ? `${cliente.nome} ${cliente.cognome}`.trim() : '';
            if (telefono || nominativo) {
              setSmsModal({
                nominativo: nominativo || 'Cliente',
                telefono,
                codice,
                azione: { tipo: 'sconto_creazione', tipoSconto, valoreSconto },
              });
            }
          }}
        />
      )}
      {smsModal && (
        <SmsCartaModal
          nominativo={smsModal.nominativo}
          codice={smsModal.codice}
          telefono={smsModal.telefono}
          azione={smsModal.azione}
          onClose={() => setSmsModal(null)}
        />
      )}
      {storicoCarta && (
        <StoricoModal
          titolo={`Utilizzi ${storicoCarta.carta.codice}`}
          utilizzi={storicoCarta.utilizzi}
          tipo="sconto"
          onClose={() => setStoricoCarta(null)}
        />
      )}
    </div>
  );
}

// ─── Carte Premium Tab ────────────────────────────────────────────────────────

function CartePremium({ clienti }: { clienti: Cliente[] }) {
  const [carte, setCarte] = useState<CartaPremium[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordGate, setShowPasswordGate] = useState<'nuova' | 'ricarica' | 'elimina' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [cartaPendingRicarica, setCartaPendingRicarica] = useState<CartaPremium | null>(null);
  const [ricaricaCarta, setRicaricaCarta] = useState<CartaPremium | null>(null);
  const [storicoCarta, setStoricoCarta] = useState<{ carta: CartaPremium; utilizzi: UtilizzoCarta[]; ricariche: RicaricaPremium[] } | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [smsModal, setSmsModal] = useState<{ carta: CartaPremium; azione: AzioneCarta } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbSelectWithRelated({
      table: 'carte_premium',
      filters: [{ col: 'deleted_at', op: 'is_null' }],
      orderBy: [{ col: 'created_at', asc: false }],
      relations: [{ key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, cognome, telefono' }],
      supabaseSelect: '*, clienti(nome, cognome, telefono)',
    });
    setCarte((data || []) as CartaPremium[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleAttiva(carta: CartaPremium) {
    await dbUpdate({ table: 'carte_premium', id: carta.id, data: { attiva: carta.attiva === false } });
    load();
  }

  async function confirmDeleteCarta(id: string) {
    await dbUpdate({ table: 'carte_premium', id, data: { deleted_at: new Date().toISOString() } });
    setPendingDeleteId(null);
    load();
  }

  function deleteCarta(id: string) {
    setPendingDeleteId(id);
    setShowPasswordGate('elimina');
  }

  async function openStorico(carta: CartaPremium) {
    const [uRes, rRes] = await Promise.all([
      dbSelect({ table: 'utilizzi_carta_premium', filters: [{ col: 'carta_premium_id', op: 'eq', val: carta.id }], orderBy: [{ col: 'created_at', asc: false }] }),
      dbSelect({ table: 'ricariche_carta_premium', filters: [{ col: 'carta_premium_id', op: 'eq', val: carta.id }], orderBy: [{ col: 'created_at', asc: false }] }),
    ]);
    setStoricoCarta({ carta, utilizzi: (uRes.data || []) as UtilizzoCarta[], ricariche: (rRes.data || []) as RicaricaPremium[] });
  }

  function copyCodice(codice: string) {
    navigator.clipboard.writeText(codice).catch(() => {});
    setCopied(codice);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = carte.filter(c => {
    if (!search) return true;
    return c.codice.toLowerCase().includes(search.toLowerCase()) ||
      (c.clienti && `${c.clienti.nome} ${c.clienti.cognome}`.toLowerCase().includes(search.toLowerCase()));
  });

  const saldoTotale = carte.reduce((s, c) => s + c.saldo, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Barra azioni */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per codice o cliente..."
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 bg-white" />
        </div>
        <button onClick={() => setShowPasswordGate('nuova')} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0">
          <Plus size={15} />
          Nuova carta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Carte attive', value: carte.filter(c => c.attiva !== false).length, display: String(carte.filter(c => c.attiva !== false).length), color: 'text-emerald-600' },
          { label: 'Saldo totale', value: saldoTotale, display: `€${fmt(saldoTotale)}`, color: 'text-stone-700' },
          { label: 'Carte esaurite', value: carte.filter(c => c.saldo <= 0 && c.attiva !== false).length, display: String(carte.filter(c => c.saldo <= 0 && c.attiva !== false).length), color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.display}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista carte */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Star size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Nessuna carta premium</p>
          <p className="text-xs text-stone-400 mt-1">Crea la prima carta premium nominativa</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(carta => {
            const saldoBasso = carta.saldo < 20 && carta.saldo > 0;
            const saldoEsaurito = carta.saldo <= 0;
            const esauritaDisattiva = carta.attiva === false && saldoEsaurito;
            return (
              <div key={carta.id} className={`bg-white rounded-2xl border p-4 transition-all ${esauritaDisattiva ? 'border-red-200 opacity-70' : carta.attiva === false ? 'border-stone-100 opacity-60' : saldoEsaurito ? 'border-red-200' : saldoBasso ? 'border-amber-200' : 'border-stone-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${esauritaDisattiva ? 'bg-red-100' : carta.attiva === false ? 'bg-stone-100' : saldoEsaurito ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      <Star size={18} className={esauritaDisattiva ? 'text-red-500' : carta.attiva === false ? 'text-stone-400' : saldoEsaurito ? 'text-red-500' : 'text-emerald-600'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copyCodice(carta.codice)} className="font-mono text-sm font-bold text-stone-800 hover:text-emerald-600 transition-colors flex items-center gap-1">
                          {carta.codice}
                          {copied === carta.codice ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="text-stone-300" />}
                        </button>
                        {carta.attiva === false && !saldoEsaurito && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-semibold">Disattiva</span>}
                        {saldoEsaurito && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Saldo esaurito</span>}
                        {saldoBasso && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Saldo basso</span>}
                      </div>
                      {carta.clienti && <p className="text-xs text-stone-500 mt-0.5 font-medium">{carta.clienti.nome} {carta.clienti.cognome}</p>}
                      {carta.note && <p className="text-xs text-stone-400 mt-0.5">{carta.note}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <div className={`text-lg font-bold ${saldoEsaurito ? 'text-red-500' : saldoBasso ? 'text-amber-600' : 'text-emerald-600'}`}>
                          €{fmt(carta.saldo)}
                        </div>
                        <span className="text-xs text-stone-400">saldo disponibile</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setCartaPendingRicarica(carta); setShowPasswordGate('ricarica'); }} className="p-2 rounded-lg hover:bg-emerald-50 text-stone-400 hover:text-emerald-600 transition-colors" title="Ricarica">
                      <Wallet size={15} />
                    </button>
                    <button onClick={() => openStorico(carta)} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600" title="Storico">
                      <History size={15} />
                    </button>
                    <button onClick={() => toggleAttiva(carta)} className={`p-2 rounded-lg transition-colors ${carta.attiva !== false ? 'hover:bg-red-50 text-stone-400 hover:text-red-500' : 'hover:bg-emerald-50 text-stone-400 hover:text-emerald-500'}`}>
                      <AlertCircle size={15} />
                    </button>
                    <button onClick={() => deleteCarta(carta.id)} className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPasswordGate && (
        <PasswordGateModal
          titolo={showPasswordGate === 'nuova' ? 'Nuova carta premium' : showPasswordGate === 'elimina' ? 'Elimina carta premium' : 'Ricarica carta premium'}
          descrizione={showPasswordGate === 'nuova' ? 'Inserisci la password per creare una nuova carta premium.' : showPasswordGate === 'elimina' ? 'Inserisci la password per eliminare questa carta premium.' : 'Inserisci la password per ricaricare questa carta premium.'}
          onSuccess={() => {
            if (showPasswordGate === 'nuova') { setShowPasswordGate(null); setShowModal(true); }
            else if (showPasswordGate === 'elimina' && pendingDeleteId) { setShowPasswordGate(null); confirmDeleteCarta(pendingDeleteId); }
            else { setShowPasswordGate(null); setRicaricaCarta(cartaPendingRicarica); setCartaPendingRicarica(null); }
          }}
          onClose={() => { setShowPasswordGate(null); setCartaPendingRicarica(null); setPendingDeleteId(null); }}
        />
      )}
      {showModal && (
        <NuovaCartaPremiumModal
          clienti={clienti}
          onClose={() => setShowModal(false)}
          onSaved={({ codice, creditoIniziale, cliente }) => {
            setShowModal(false);
            load();
            setSmsModal({
              carta: { id: '', codice, cliente_id: cliente.id, saldo: creditoIniziale, note: '', attiva: true, created_at: '', clienti: cliente },
              azione: { tipo: 'creazione', credito: creditoIniziale },
            });
          }}
        />
      )}
      {ricaricaCarta && (
        <RicaricaModal
          carta={ricaricaCarta}
          onClose={() => setRicaricaCarta(null)}
          onSaved={({ importo, prezzoCliente, nuovoSaldo, tipo }) => {
            const carta = ricaricaCarta!;
            setRicaricaCarta(null);
            load();
            if (tipo === 'standard') {
              setSmsModal({ carta, azione: { tipo: 'ricarica', credito: importo, prezzoClientePagato: prezzoCliente, nuovoSaldo } });
            } else {
              setSmsModal({ carta, azione: { tipo: 'ricarica_gratuita', credito: importo, nuovoSaldo } });
            }
          }}
        />
      )}
      {storicoCarta && (
        <StoricoModal
          titolo={`Storico ${storicoCarta.carta.codice}`}
          utilizzi={storicoCarta.utilizzi}
          ricariche={storicoCarta.ricariche}
          tipo="premium"
          onClose={() => setStoricoCarta(null)}
        />
      )}
      {smsModal && (
        <SmsCartaModal
          nominativo={smsModal.carta.clienti ? `${smsModal.carta.clienti.nome} ${smsModal.carta.clienti.cognome}`.trim() : ''}
          codice={smsModal.carta.codice}
          telefono={smsModal.carta.clienti?.telefono ?? ''}
          azione={smsModal.azione}
          onClose={() => setSmsModal(null)}
        />
      )}
    </div>
  );
}

function genCodiceGift(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// ─── Types Gift Pass ──────────────────────────────────────────────────────────

interface ProdottoRivenditaCatalogo {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  prezzo_vendita: number;
}

interface GiftPass {
  id: string;
  codice: string;
  tipo: 'valore' | 'prodotto';
  valore_euro: number | null;
  prodotto_id: string | null;
  prodotto_nome: string | null;
  occasione: 'invito' | 'compleanno' | 'regalo';
  scadenza_ritiro_giorni: number;
  scadenza_uso_giorni: number;
  destinataria_nome: string;
  destinataria_telefono: string;
  destinataria_cliente_id: string | null;
  cliente_id: string | null;
  nominativa: boolean;
  attivata_at: string | null;
  scadenza_uso: string | null;
  fiche_id: string | null;
  utilizzata: boolean;
  attiva: boolean;
  note: string;
  created_at: string;
}

function statoGiftPass(gp: GiftPass): 'da_ritirare' | 'attivata' | 'utilizzata' | 'scaduta' {
  if (gp.utilizzata) return 'utilizzata';
  const ora = new Date();
  if (!gp.attivata_at) {
    if (gp.tipo === 'valore') return 'da_ritirare';
    // prodotto: controlla scadenza ritiro (created_at + scadenza_ritiro_giorni)
    const cAt = new Date(gp.created_at);
    cAt.setDate(cAt.getDate() + gp.scadenza_ritiro_giorni);
    if (ora > cAt) return 'scaduta';
    return 'da_ritirare';
  }
  // attivata: controlla scadenza uso
  if (gp.tipo !== 'valore' && gp.scadenza_uso) {
    const scadUso = new Date(gp.scadenza_uso);
    if (ora > scadUso) return 'scaduta';
  }
  return 'attivata';
}

// ─── Nuova Gift Pass Modal ────────────────────────────────────────────────────

function NuovaGiftPassModal({ clienti, onClose, onSaved }: {
  clienti: Cliente[];
  onClose: () => void;
  onSaved: (gp: GiftPass, compratore_nome?: string) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    codice: genCodiceGift(),
    tipo: 'valore' as 'valore' | 'prodotto',
    valore_euro: 50,
    prodotto_id: '',
    occasione: 'invito' as 'invito' | 'compleanno' | 'regalo',
    scadenza_ritiro_giorni: 30,
    scadenza_uso_giorni: 60,
    note: '',
  });
  // Nominativa (solo prodotto): la cliente acquista per se stessa
  const [nominativa, setNominativa] = useState(false);

  // Destinataria: cliente esistente o nuova
  const [destinatariaId, setDestinatariaId] = useState('');
  const [nuovaNome, setNuovaNome] = useState('');
  const [nuovaCognome, setNuovaCognome] = useState('');
  const [nuovaTelefono, setNuovaTelefono] = useState('');
  const [registraNuova, setRegistraNuova] = useState(false);

  // Compratore/donatore: chi ha pagato il gift pass
  const [compratoreId, setCompratoreId] = useState('');
  const [compratoreRegistra, setCompratoreRegistra] = useState(false);
  const [compratoreNome, setCompratoreNome] = useState('');
  const [compratoreCognome, setCompratoreCognome] = useState('');
  const [compratoreTelefono, setCompratoreTelefono] = useState('');

  const [prodotti, setProdotti] = useState<ProdottoRivenditaCatalogo[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dbSelect({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'categoria', asc: true }, { col: 'nome', asc: true }] })
      .then(({ data }) => setProdotti((data || []) as ProdottoRivenditaCatalogo[]));
  }, []);

  const clienteSel = clienti.find(c => c.id === destinatariaId) ?? null;
  const prodottoSel = prodotti.find(p => p.id === form.prodotto_id) ?? null;

  // Risolvi nome e telefono finali
  const nomeFinale = registraNuova ? `${nuovaNome.trim()} ${nuovaCognome.trim()}`.trim() : (clienteSel ? `${clienteSel.nome} ${clienteSel.cognome}`.trim() : '');
  const telefonoFinale = registraNuova ? nuovaTelefono.trim() : (clienteSel?.telefono ?? '');

  const canSave = (
    (form.tipo === 'valore' && form.valore_euro > 0) ||
    (form.tipo === 'prodotto' && !!form.prodotto_id)
  ) && (
    (!compratoreRegistra && compratoreId !== '') ||
    (compratoreRegistra && compratoreNome.trim() !== '')
  );

  async function save() {
    if (!canSave) return;
    setSaving(true);

    // Destinataria
    let clienteId: string | null = registraNuova ? null : (destinatariaId || null);
    if (registraNuova && nuovaNome.trim()) {
      const { data: newCliente } = await dbInsert({ table: 'clienti', data: {
        nome: nuovaNome.trim(),
        cognome: nuovaCognome.trim(),
        telefono: nuovaTelefono.trim(),
        user_id: user?.id,
      }});
      clienteId = (newCliente as { id: string } | null)?.id ?? null;
    }

    // Compratore
    let compratoreFinalId: string | null = compratoreRegistra ? null : (compratoreId || null);
    if (compratoreRegistra && compratoreNome.trim()) {
      const { data: newComp } = await dbInsert({ table: 'clienti', data: {
        nome: compratoreNome.trim(),
        cognome: compratoreCognome.trim(),
        telefono: compratoreTelefono.trim(),
        user_id: user?.id,
      }});
      compratoreFinalId = (newComp as { id: string } | null)?.id ?? null;
    }

    const { data } = await dbInsert({ table: 'gift_pass', data: {
      codice: form.codice,
      tipo: form.tipo,
      valore_euro: form.tipo === 'valore' ? form.valore_euro : null,
      prodotto_id: form.tipo === 'prodotto' ? form.prodotto_id : null,
      prodotto_nome: form.tipo === 'prodotto' ? (prodottoSel ? `${prodottoSel.nome}${prodottoSel.marca ? ` (${prodottoSel.marca})` : ''}` : null) : null,
      occasione: form.occasione,
      scadenza_ritiro_giorni: form.scadenza_ritiro_giorni,
      scadenza_uso_giorni: form.scadenza_uso_giorni,
      destinataria_nome: nominativa ? '' : nomeFinale,
      destinataria_telefono: nominativa ? '' : telefonoFinale,
      destinataria_cliente_id: nominativa ? null : clienteId,
      cliente_id: compratoreFinalId,
      nominativa: nominativa && form.tipo === 'prodotto',
      note: form.note.trim(),
      utilizzata: false,
      attiva: true,
      user_id: user?.id,
    }});

    // Crea fiche automatica per il compratore
    if (compratoreFinalId && data) {
      const giftPassId = (data as { id: string }).id;
      const importoFiche = form.tipo === 'valore'
        ? (form.valore_euro ?? 0)
        : (prodottoSel?.prezzo_vendita ?? 0);
      const today = localDateStr();
      const { data: ficheData } = await dbInsert({ table: 'fiches', data: {
        manuale: true,
        cliente_id: compratoreFinalId,
        tipo_fiche: 'gift_pass',
        note: `Gift Pass #${form.codice}`,
        data_riferimento: today,
        user_id: user?.id,
      }});
      const ficheId = (ficheData as { id: string } | null)?.id;
      if (ficheId) {
        const destLabel = nomeFinale ? ` — per ${nomeFinale}` : '';
        await dbInsert({ table: 'fiche_voci', data: {
          fiche_id: ficheId,
          tipo: 'extra',
          nome_voce: `Gift Pass #${form.codice}${destLabel}`,
          parrucchiere_id: null,
          nome_parrucchiere: '',
          prezzo: importoFiche,
          note: '',
          ordine: 0,
          user_id: user?.id,
        }});
        await dbUpdate({ table: 'gift_pass', id: giftPassId, data: { fiche_acquisto_id: ficheId } });
      }
    }

    // Calcola nome compratore formattato "Elena C."
    let compratore_nome_fmt: string | undefined;
    if (compratoreFinalId) {
      const cn = compratoreRegistra ? compratoreNome.trim() : (clienti.find(c => c.id === compratoreFinalId)?.nome ?? '');
      const cc = compratoreRegistra ? compratoreCognome.trim() : (clienti.find(c => c.id === compratoreFinalId)?.cognome ?? '');
      if (cn) compratore_nome_fmt = cc ? `${cn} ${cc.charAt(0)}.` : cn;
    }

    setSaving(false);
    if (data) onSaved(data as unknown as GiftPass, compratore_nome_fmt);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Gift size={16} className="text-violet-600" />
            </div>
            <h2 className="font-bold text-stone-800">Nuovo Gift Pass</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Tipo regalo</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setForm(f => ({ ...f, tipo: 'valore' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${form.tipo === 'valore' ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                <Euro size={16} />
                Valore in €
              </button>
              <button onClick={() => setForm(f => ({ ...f, tipo: 'prodotto' }))}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${form.tipo === 'prodotto' ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                <Package size={16} />
                Prodotto
              </button>
            </div>
          </div>

          {/* Valore / Prodotto */}
          {form.tipo === 'valore' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Valore (€)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[20, 30, 50, 80, 100].map(v => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, valore_euro: v }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${form.valore_euro === v ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                    €{v}
                  </button>
                ))}
              </div>
              <input type="number" min={1} step={5} value={form.valore_euro}
                onChange={e => setForm(f => ({ ...f, valore_euro: Number(e.target.value) }))}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
              <p className="text-xs text-stone-400 mt-1">La carta con valore in € non scade mai.</p>
            </div>
          )}
          {form.tipo === 'prodotto' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Prodotto da regalare <span className="text-red-500">*</span></label>
              <select value={form.prodotto_id} onChange={e => setForm(f => ({ ...f, prodotto_id: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400">
                <option value="">— Seleziona prodotto —</option>
                {prodotti.map(p => (
                  <option key={p.id} value={p.id}>{p.categoria ? `${p.categoria} · ` : ''}{p.nome}{p.marca ? ` (${p.marca})` : ''} — €{p.prezzo_vendita.toFixed(2)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Modalità: Per me / Da regalare (solo prodotto) */}
          {form.tipo === 'prodotto' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Per chi è il Gift Pass?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNominativa(false)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${!nominativa ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <Gift size={16} />
                  Da regalare
                </button>
                <button
                  onClick={() => setNominativa(true)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${nominativa ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <Star size={16} />
                  Per la cliente
                </button>
              </div>
              {nominativa && (
                <p className="text-[10px] text-violet-700 bg-violet-50 rounded-lg px-3 py-2 mt-2">
                  La cliente usa il Gift Pass per se stessa. Potra' regalarlo in seguito dal salone inserendo i dati della destinataria.
                </p>
              )}
            </div>
          )}

          {/* Occasione */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Occasione</label>
            <div className="grid grid-cols-3 gap-2">
              {([['invito', 'Invito'], ['compleanno', 'Compleanno'], ['regalo', 'Regalo']] as const).map(([val, lbl]) => (
                <button key={val} onClick={() => setForm(f => ({ ...f, occasione: val }))}
                  className={`px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${form.occasione === val ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Scadenze (solo per prodotto) */}
          {form.tipo === 'prodotto' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Giorni per ritirarlo</label>
                <input type="number" min={1} step={1} value={form.scadenza_ritiro_giorni}
                  onChange={e => setForm(f => ({ ...f, scadenza_ritiro_giorni: Number(e.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <p className="text-[10px] text-stone-400 mt-0.5">Giorni dalla creazione</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Giorni per usarlo</label>
                <input type="number" min={1} step={1} value={form.scadenza_uso_giorni}
                  onChange={e => setForm(f => ({ ...f, scadenza_uso_giorni: Number(e.target.value) }))}
                  onFocus={e => e.target.select()}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <p className="text-[10px] text-stone-400 mt-0.5">Giorni dall'attivazione</p>
              </div>
            </div>
          )}

          {/* Compratore (chi ha pagato) */}
          <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Acquistata da (compratore)
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => { setCompratoreRegistra(false); setCompratoreNome(''); setCompratoreCognome(''); setCompratoreTelefono(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${!compratoreRegistra ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                Cliente esistente
              </button>
              <button
                onClick={() => { setCompratoreRegistra(true); setCompratoreId(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${compratoreRegistra ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                Nuova cliente
              </button>
            </div>

            {!compratoreRegistra ? (
              <select
                value={compratoreId}
                onChange={e => setCompratoreId(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              >
                <option value="">— Seleziona cliente —</option>
                {clienti.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} {c.cognome}{c.telefono ? ` · ${c.telefono}` : ''}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={compratoreNome}
                    onChange={e => setCompratoreNome(e.target.value)}
                    placeholder="Nome *"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  />
                  <input
                    value={compratoreCognome}
                    onChange={e => setCompratoreCognome(e.target.value)}
                    placeholder="Cognome"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  />
                </div>
                <input
                  type="tel"
                  value={compratoreTelefono}
                  onChange={e => setCompratoreTelefono(e.target.value)}
                  placeholder="Telefono"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                />
              </div>
            )}
            <p className="text-xs text-stone-400">Chi ha pagato il Gift Pass. Verrà creata una fiche da convalidare intestata a lei.</p>
          </div>

          {/* Destinataria (nascosta se nominativa) */}
          {!nominativa && <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Destinataria <span className="text-stone-400 font-normal normal-case">(opzionale)</span>
            </label>

            {/* Toggle: cliente esistente vs nuova */}
            <div className="flex gap-2">
              <button
                onClick={() => { setRegistraNuova(false); setNuovaNome(''); setNuovaCognome(''); setNuovaTelefono(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${!registraNuova ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                Cliente esistente
              </button>
              <button
                onClick={() => { setRegistraNuova(true); setDestinatariaId(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${registraNuova ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}>
                Nuova cliente
              </button>
            </div>

            {!registraNuova ? (
              <select
                value={destinatariaId}
                onChange={e => setDestinatariaId(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              >
                <option value="">— Seleziona cliente —</option>
                {clienti.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} {c.cognome}{c.telefono ? ` · ${c.telefono}` : ' — senza tel.'}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      value={nuovaNome}
                      onChange={e => setNuovaNome(e.target.value)}
                      placeholder="Nome *"
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <input
                      value={nuovaCognome}
                      onChange={e => setNuovaCognome(e.target.value)}
                      placeholder="Cognome"
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    />
                  </div>
                </div>
                <input
                  type="tel"
                  value={nuovaTelefono}
                  onChange={e => setNuovaTelefono(e.target.value)}
                  placeholder="Telefono"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                />
                <p className="text-[10px] text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
                  Verrà creata una scheda cliente nel gestionale e il Gift Pass verrà associato a lei.
                </p>
              </div>
            )}
          </div>}

          {/* Codice */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Codice Gift Pass</label>
            <div className="flex gap-2">
              <input value={form.codice} onChange={e => setForm(f => ({ ...f, codice: e.target.value }))}
                maxLength={5}
                className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:border-violet-400" />
              <button onClick={() => setForm(f => ({ ...f, codice: genCodiceGift() }))} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"><RefreshCw size={14} className="text-stone-500" /></button>
              <button onClick={() => { navigator.clipboard.writeText(form.codice).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-2 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-stone-500" />}
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note opzionali..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || !canSave}
            className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Creazione...' : 'Crea Gift Pass'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gift Pass WhatsApp Modal ─────────────────────────────────────────────────

function GiftPassWaModal({ gp, nomeSalone, compratore_nome, onClose }: { gp: GiftPass; nomeSalone: string; compratore_nome?: string; onClose: () => void }) {
  const [telefono, setTelefono] = useState('');
  const [maps, setMaps] = useState('');
  const [sito, setSito] = useState('');
  const [tplSalone, setTplSalone] = useState('');
  const [tplCliente, setTplCliente] = useState('');
  const [includiMappa, setIncludiMappa] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messaggio, setMessaggio] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      getImpostazione('azienda_telefono'),
      getImpostazione('azienda_google_maps'),
      getImpostazione('azienda_sito_prenotazioni'),
      getImpostazione('wa_template_gp_salone'),
      getImpostazione('wa_template_gp_cliente'),
      getImpostazione('wa_includi_mappa'),
    ]).then(([tel, mp, sit, ts, tc, im]) => {
      setTelefono(tel ?? '');
      setMaps(mp ?? '');
      setSito(sit ?? '');
      setTplSalone(ts ?? DEFAULT_WA_GP_SALONE);
      setTplCliente(tc ?? DEFAULT_WA_GP_CLIENTE);
      setIncludiMappa(im === 'true');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    const isFromSalone = !!gp.destinataria_nome;
    const tpl = isFromSalone ? tplSalone : tplCliente;
    const sn = nomeSalone || 'il salone';
    const dest = gp.destinataria_nome ? gp.destinataria_nome.split(' ')[0] : '';
    const primoNome = (compratore_nome ?? '').split(' ')[0].toLowerCase();
    const genere = primoNome.endsWith('a') ? 'f' : 'm';
    const donanteStr = compratore_nome
      ? (genere === 'f' ? `La tua amica ${compratore_nome}` : `Il tuo amico ${compratore_nome}`)
      : '';

    let msg = applyWaTemplate(tpl, {
      nome_salone: sn,
      codice: gp.codice,
      telefono,
      sito,
      valore: String(gp.valore_euro ?? 0),
      destinataria: dest,
      donante: donanteStr,
      sconto: '',
    });

    if (includiMappa && maps) {
      msg = msg.trimEnd() + `\n\n${maps}`;
    }

    if (gp.scadenza_uso_giorni && gp.scadenza_uso_giorni > 0) {
      msg += `\n\nHai ${gp.scadenza_uso_giorni} giorni di tempo per riscattare il tuo omaggio.`;
    }
    setMessaggio(msg);
  }, [loading, gp, telefono, maps, sito, tplSalone, tplCliente, includiMappa, nomeSalone, compratore_nome]);

  const hasDestinaratia = !!gp.destinataria_nome;
  const hasPhone = !!gp.destinataria_telefono?.trim();

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasDestinaratia ? 'bg-green-100' : 'bg-blue-100'}`}>
              <Send size={14} className={hasDestinaratia ? 'text-green-600' : 'text-blue-600'} />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">
                {hasDestinaratia ? 'Notifica destinataria' : 'Messaggio per la donatrice'}
              </p>
              <p className="text-xs text-stone-400">
                {hasDestinaratia
                  ? `Gift Pass ${gp.codice} · ${gp.destinataria_nome}`
                  : `Gift Pass ${gp.codice} · da inviare tramite ${compratore_nome ?? 'la donatrice'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={15} className="text-stone-500" /></button>
        </div>
        {!hasDestinaratia && (
          <p className="mx-5 mt-3 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 flex-shrink-0">
            Nessuna destinataria registrata. Copia questo messaggio e consegnalo alla donatrice affinché lo invii dal suo telefono.
          </p>
        )}
        <div className="px-5 pt-4 pb-2 overflow-y-auto flex-1">
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Messaggio</label>
          <textarea value={messaggio} onChange={e => setMessaggio(e.target.value)} rows={10}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 resize-none font-mono transition-colors" />
        </div>
        {hasDestinaratia && !hasPhone && (
          <p className="mx-5 mt-1 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Nessun numero di telefono registrato per questa destinataria.</p>
        )}
        <div className="flex gap-2 px-5 py-4 flex-shrink-0">
          <button onClick={() => { navigator.clipboard.writeText(messaggio).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copiato!' : 'Copia'}
          </button>
          {hasDestinaratia && hasPhone && (
            <button onClick={async () => {
              const donataData: Record<string, unknown> = { donata: true };
              if (gp.scadenza_uso_giorni && gp.scadenza_uso_giorni > 0) {
                const scadenza = new Date();
                scadenza.setDate(scadenza.getDate() + gp.scadenza_uso_giorni);
                donataData.scadenza_uso = scadenza.toISOString();
              }
              await dbUpdate({ table: 'gift_pass', id: gp.id, data: donataData }).catch(() => {});

              // Popup "ha donato" solo se la ricevente non ha né scheda cliente né scheda da confermare
              const telRicevente = gp.destinataria_telefono?.trim();
              if (telRicevente) {
                const [{ data: existCliente }, { data: existScheda }] = await Promise.all([
                  supabase.from('clienti').select('id').eq('telefono', telRicevente).is('deleted_at', null).limit(1).maybeSingle(),
                  supabase.from('schede_clienti_da_confermare').select('id').eq('telefono', telRicevente).eq('stato', 'in_attesa').limit(1).maybeSingle(),
                ]);
                if (!existCliente && !existScheda) {
                  window.dispatchEvent(new CustomEvent('carta_donata', { detail: { donatrice: compratore_nome ?? '' } }));
                }
              }

              apriWhatsApp(gp.destinataria_telefono, messaggio);
              onClose();
            }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors">
              <Send size={14} />
              WhatsApp
            </button>
          )}
        </div>
        <div className="px-5 pb-4 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors">
            {hasDestinaratia ? 'Salta notifica' : 'Chiudi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Converti Gift Pass Nominativa in Regalo ──────────────────────────────────

function ConvertToGiftModal({ gp, onClose, onConverted }: {
  gp: GiftPass;
  onClose: () => void;
  onConverted: (updated: GiftPass) => void;
}) {
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = nome.trim() !== '' && telefono.trim() !== '';

  async function save() {
    if (!canSave) return;
    setSaving(true);
    await dbUpdate({ table: 'gift_pass', id: gp.id, data: {
      nominativa: false,
      destinataria_nome: nome.trim(),
      destinataria_telefono: telefono.trim(),
    }});
    onConverted({
      ...gp,
      nominativa: false,
      destinataria_nome: nome.trim(),
      destinataria_telefono: telefono.trim(),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Gift size={16} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Regala Gift Pass</p>
              <p className="text-xs text-stone-400">Codice: {gp.codice}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={15} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-stone-500">Inserisci i dati della destinataria. Il Gift Pass le verrà intestato e potrai inviarle il codice via WhatsApp.</p>

          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Nome destinataria <span className="text-red-500">*</span></label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome e cognome"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Telefono destinataria <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="3xx xxxxxxx"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || !canSave}
            className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Conferma e invia WA'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gift Pass Tab ────────────────────────────────────────────────────────────

const STATO_LABEL: Record<string, string> = {
  da_ritirare: 'Da ritirare',
  attivata: 'Attivata',
  utilizzata: 'Utilizzata',
  scaduta: 'Scaduta',
};
const STATO_COLOR: Record<string, string> = {
  da_ritirare: 'bg-amber-100 text-amber-700',
  attivata: 'bg-emerald-100 text-emerald-700',
  utilizzata: 'bg-stone-100 text-stone-500',
  scaduta: 'bg-red-100 text-red-600',
};

function GiftPassTab({ clienti }: { clienti: Cliente[] }) {
  const [cards, setCards] = useState<GiftPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordGate, setShowPasswordGate] = useState<'nuova' | 'elimina' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroStato, setFiltroStato] = useState<'tutte' | 'da_ritirare' | 'attivata' | 'utilizzata' | 'scaduta'>('tutte');
  const [waModal, setWaModal] = useState<{ gp: GiftPass; compratore_nome?: string } | null>(null);
  const [convertModal, setConvertModal] = useState<GiftPass | null>(null);
  const [nomeSalone, setNomeSalone] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await invalidateTableCache('gift_pass');
    const [res, sn] = await Promise.all([
      dbSelect({ table: 'gift_pass', filters: [{ col: 'deleted_at', op: 'is_null' }], orderBy: [{ col: 'created_at', asc: false }] }),
      getImpostazione('azienda_nome'),
    ]);
    setCards((res.data || []) as GiftPass[]);
    setNomeSalone(sn ?? 'I Venzi');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete(id: string) {
    await dbUpdate({ table: 'gift_pass', id, data: { deleted_at: new Date().toISOString() } });
    setPendingDeleteId(null);
    load();
  }

  function copyCodice(codice: string) {
    navigator.clipboard.writeText(codice).catch(() => {});
    setCopied(codice);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = cards.filter(gp => {
    const stato = statoGiftPass(gp);
    const compratore = clienti.find(c => c.id === gp.cliente_id);
    const compratoreNome = compratore ? `${compratore.nome} ${compratore.cognome}`.toLowerCase() : '';
    const q = search.toLowerCase();
    const matchSearch = !search ||
      gp.codice.toLowerCase().includes(q) ||
      gp.destinataria_nome.toLowerCase().includes(q) ||
      compratoreNome.includes(q);
    const matchStato = filtroStato === 'tutte' || stato === filtroStato;
    return matchSearch && matchStato;
  });

  const stats = {
    totale: cards.length,
    da_ritirare: cards.filter(g => statoGiftPass(g) === 'da_ritirare').length,
    attivata: cards.filter(g => statoGiftPass(g) === 'attivata').length,
    utilizzata: cards.filter(g => statoGiftPass(g) === 'utilizzata').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Barra azioni */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per codice o nome..."
            className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 bg-white" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['tutte', 'da_ritirare', 'attivata', 'utilizzata', 'scaduta'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStato(s)}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors border ${filtroStato === s ? 'bg-violet-500 text-white border-violet-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              {s === 'tutte' ? 'Tutte' : STATO_LABEL[s]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPasswordGate('nuova')}
          className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0">
          <Plus size={15} />
          Nuovo Gift Pass
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Totale', value: stats.totale, color: 'text-stone-700' },
          { label: 'Da ritirare', value: stats.da_ritirare, color: 'text-amber-600' },
          { label: 'Attivati', value: stats.attivata, color: 'text-emerald-600' },
          { label: 'Utilizzati', value: stats.utilizzata, color: 'text-stone-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Gift size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">Nessun Gift Pass trovato</p>
          <p className="text-xs text-stone-400 mt-1">Crea il primo Gift Pass per iniziare</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(gp => {
            const stato = statoGiftPass(gp);
            const isAttiva = stato === 'da_ritirare' || stato === 'attivata';
            return (
              <div key={gp.id} className={`rounded-2xl border p-4 transition-all ${isAttiva ? 'bg-violet-50 border-violet-200' : 'border-stone-100 opacity-70'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAttiva ? 'bg-violet-100' : 'bg-stone-100'}`}>
                      {gp.tipo === 'prodotto'
                        ? <Package size={18} className={isAttiva ? 'text-violet-600' : 'text-stone-400'} />
                        : <Euro size={18} className={isAttiva ? 'text-violet-600' : 'text-stone-400'} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copyCodice(gp.codice)}
                          className="font-mono text-lg font-bold text-stone-800 hover:text-violet-600 transition-colors flex items-center gap-1 tracking-widest">
                          {gp.codice}
                          {copied === gp.codice ? <Check size={12} className="text-emerald-500" /> : <Copy size={11} className="text-stone-300" />}
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATO_COLOR[stato]}`}>{STATO_LABEL[stato]}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${gp.tipo === 'prodotto' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                          {gp.tipo === 'prodotto' ? 'Prodotto' : `€${gp.valore_euro}`}
                        </span>
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium capitalize">{gp.occasione}</span>
                        {gp.nominativa && (
                          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">Nominativa</span>
                        )}
                      </div>
                      {gp.tipo === 'prodotto' && gp.prodotto_nome && (
                        <p className="text-xs text-stone-600 mt-0.5 font-medium">{gp.prodotto_nome}</p>
                      )}
                      {(() => {
                        const comp = clienti.find(c => c.id === gp.cliente_id);
                        const compNome = comp ? `${comp.nome} ${comp.cognome}`.trim() : null;
                        const destNome = gp.destinataria_nome?.trim() || null;
                        const destTel = gp.destinataria_telefono?.trim() || null;
                        if (!compNome && !destNome) return null;
                        return (
                          <div className="flex items-center gap-x-4 gap-y-0.5 mt-1.5 flex-wrap">
                            {compNome && (
                              <span className="text-xs text-stone-500">
                                <span className="text-stone-400 font-medium">Da: </span>
                                <span className="font-semibold text-stone-700">{compNome}</span>
                              </span>
                            )}
                            {destNome && (
                              <span className="text-xs text-stone-500">
                                <span className="text-stone-400 font-medium">Per: </span>
                                <span className="font-semibold text-stone-700">{destNome}</span>
                                {destTel && <span className="text-stone-400 ml-1">{destTel}</span>}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {stato === 'attivata' && gp.scadenza_uso && gp.tipo !== 'valore' && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={11} className="text-amber-500" />
                          <span className="text-[10px] text-amber-600 font-medium">
                            Scade uso: {new Date(gp.scadenza_uso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {stato === 'da_ritirare' && gp.tipo !== 'valore' && (() => {
                        const sc = new Date(gp.created_at);
                        sc.setDate(sc.getDate() + gp.scadenza_ritiro_giorni);
                        return (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock size={11} className="text-stone-400" />
                            <span className="text-[10px] text-stone-400">
                              Scade ritiro: {sc.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        );
                      })()}
                      {stato === 'utilizzata' && gp.fiche_id && (
                        <div className="flex items-center gap-1 mt-1">
                          <ShieldCheck size={11} className="text-emerald-500" />
                          <span className="text-[10px] text-emerald-600 font-medium">Usato in fiche</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isAttiva && gp.nominativa && !gp.utilizzata && (
                      <button onClick={() => setConvertModal(gp)}
                        className="p-2 rounded-lg hover:bg-green-50 text-stone-400 hover:text-green-600 transition-colors" title="Regala a qualcun altro">
                        <Gift size={15} />
                      </button>
                    )}
                    {isAttiva && !gp.nominativa && gp.destinataria_nome && gp.destinataria_telefono && (
                      <button onClick={() => {
                        const comp = gp.cliente_id ? clienti.find(c => c.id === gp.cliente_id) : null;
                        const cn = comp ? (comp.cognome ? `${comp.nome} ${comp.cognome.charAt(0)}.` : comp.nome) : undefined;
                        setWaModal({ gp, compratore_nome: cn });
                      }} className="p-2 rounded-lg hover:bg-violet-100 text-stone-400 hover:text-violet-600 transition-colors" title="Notifica destinataria via WhatsApp">
                        <Send size={15} />
                      </button>
                    )}
                    <button onClick={() => { setPendingDeleteId(gp.id); setShowPasswordGate('elimina'); }} className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPasswordGate && (
        <PasswordGateModal
          titolo={showPasswordGate === 'nuova' ? 'Nuovo Gift Pass' : 'Elimina Gift Pass'}
          descrizione={showPasswordGate === 'nuova' ? 'Inserisci la password per creare un nuovo Gift Pass.' : 'Inserisci la password per eliminare questo Gift Pass.'}
          onSuccess={() => {
            if (showPasswordGate === 'nuova') { setShowPasswordGate(null); setShowModal(true); }
            else if (pendingDeleteId) { setShowPasswordGate(null); confirmDelete(pendingDeleteId); }
          }}
          onClose={() => { setShowPasswordGate(null); setPendingDeleteId(null); }}
        />
      )}
      {showModal && (
        <NuovaGiftPassModal
          clienti={clienti}
          onClose={() => setShowModal(false)}
          onSaved={(gp, compratore_nome) => { setShowModal(false); load(); if (gp.destinataria_nome && gp.destinataria_telefono) setWaModal({ gp, compratore_nome }); }}
        />
      )}
      {waModal && (
        <GiftPassWaModal gp={waModal.gp} nomeSalone={nomeSalone} compratore_nome={waModal.compratore_nome} onClose={() => { setWaModal(null); load(); }} />
      )}
      {convertModal && (
        <ConvertToGiftModal
          gp={convertModal}
          onClose={() => setConvertModal(null)}
          onConverted={(updated) => {
            setConvertModal(null);
            load();
            // Apri subito la WaModal per inviare il messaggio
            const comp = updated.cliente_id ? clienti.find(c => c.id === updated.cliente_id) : null;
            const cn = comp ? (comp.cognome ? `${comp.nome} ${comp.cognome.charAt(0)}.` : comp.nome) : undefined;
            setWaModal({ gp: updated, compratore_nome: cn });
          }}
        />
      )}
    </div>
  );
}



// ─── Listino Categorie Tab ────────────────────────────────────────────────────

function ListinoTab() {
  const { user } = useAuth();
  const [categorie, setCategorie] = useState<ListinoCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ListinoCategoria | null>(null);
  const [prezzi, setPrezzi] = useState<ListinoPrezzoRow[]>([]);
  const [servizi, setServizi] = useState<{ id: string; nome: string; prezzo: number; tipo: 'servizio' | 'trattamento' }[]>([]);
  const [loadingPrezzi, setLoadingPrezzi] = useState(false);
  const [showNuova, setShowNuova] = useState(false);
  const [nuovaNome, setNuovaNome] = useState('');
  const [nuovaDesc, setNuovaDesc] = useState('');
  const [savingNuova, setSavingNuova] = useState(false);
  const [editingPrezzoId, setEditingPrezzoId] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbSelect({ table: 'carte_sconto_listino_categorie', orderBy: [{ col: 'nome', asc: true }] });
    setCategorie((data || []) as ListinoCategoria[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }, { col: 'tipo', op: 'eq', val: 'servizio' }], orderBy: [{ col: 'nome', asc: true }] }),
      dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }, { col: 'tipo', op: 'eq', val: 'trattamento' }], orderBy: [{ col: 'nome', asc: true }] }),
    ]).then(([sRes, tRes]) => {
      const all = [
        ...(sRes.data || []).map((s: any) => ({ id: s.id, nome: s.nome, prezzo: s.prezzo ?? 0, tipo: 'servizio' as const })),
        ...(tRes.data || []).map((t: any) => ({ id: t.id, nome: t.nome, prezzo: t.prezzo ?? 0, tipo: 'trattamento' as const })),
      ];
      setServizi(all);
    });
  }, []);

  async function openCategoria(cat: ListinoCategoria) {
    setSelected(cat);
    setLoadingPrezzi(true);
    const { data } = await dbSelect({ table: 'carte_sconto_listino_prezzi', filters: [{ col: 'categoria_id', op: 'eq', val: cat.id }] });
    setPrezzi((data || []) as ListinoPrezzoRow[]);
    setLoadingPrezzi(false);
  }

  async function saveNuovaCategoria() {
    if (!nuovaNome.trim()) return;
    setSavingNuova(true);
    await dbInsert({ table: 'carte_sconto_listino_categorie', data: { nome: nuovaNome.trim(), descrizione: nuovaDesc.trim(), user_id: user?.id } });
    setSavingNuova(false);
    setNuovaNome('');
    setNuovaDesc('');
    setShowNuova(false);
    load();
  }

  async function deleteCategoria(id: string) {
    await dbDelete({ table: 'carte_sconto_listino_categorie', filters: [{ col: 'id', op: 'eq', val: id }] });
    if (selected?.id === id) setSelected(null);
    load();
  }

  function getPrezzoForServizio(nomeServizio: string): number | null {
    const row = prezzi.find(p => p.nome_servizio === nomeServizio);
    return row ? row.prezzo : null;
  }

  async function setPrezzo(nomeServizio: string, prezzo: number) {
    if (!selected) return;
    const existing = prezzi.find(p => p.nome_servizio === nomeServizio);
    if (existing) {
      await dbUpdate({ table: 'carte_sconto_listino_prezzi', id: existing.id, data: { prezzo } });
    } else {
      await dbInsert({ table: 'carte_sconto_listino_prezzi', data: {
        categoria_id: selected.id, nome_servizio: nomeServizio, prezzo, user_id: user?.id,
      }});
    }
    const { data } = await dbSelect({ table: 'carte_sconto_listino_prezzi', filters: [{ col: 'categoria_id', op: 'eq', val: selected.id }] });
    setPrezzi((data || []) as ListinoPrezzoRow[]);
  }

  async function removePrezzo(nomeServizio: string) {
    if (!selected) return;
    const existing = prezzi.find(p => p.nome_servizio === nomeServizio);
    if (existing) {
      await dbDelete({ table: 'carte_sconto_listino_prezzi', filters: [{ col: 'id', op: 'eq', val: existing.id }] });
      setPrezzi(prev => prev.filter(p => p.nome_servizio !== nomeServizio));
    }
  }

  function startEdit(nomeServizio: string) {
    const val = getPrezzoForServizio(nomeServizio);
    setEditingPrezzoId(nomeServizio);
    setEditingVal(val !== null ? String(val) : '');
  }

  async function commitEdit(nomeServizio: string) {
    const n = parseFloat(editingVal.replace(',', '.'));
    if (!isNaN(n) && n >= 0) {
      await setPrezzo(nomeServizio, n);
    }
    setEditingPrezzoId(null);
    setEditingVal('');
  }

  return (
    <div className="flex gap-6 h-full min-h-[60vh]">
      {/* Colonna sinistra: lista categorie */}
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-stone-700">Listini salvati</p>
          <button
            onClick={() => setShowNuova(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={12} />
            Nuovo
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : categorie.length === 0 ? (
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-6 text-center">
            <BookOpen size={28} className="text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500 font-medium">Nessun listino</p>
            <p className="text-xs text-stone-400 mt-0.5">Crea il primo listino per iniziare</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categorie.map(cat => (
              <div
                key={cat.id}
                onClick={() => openCategoria(cat)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 cursor-pointer transition-all ${selected?.id === cat.id ? 'bg-orange-50 border-orange-300' : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-amber-50'}`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${selected?.id === cat.id ? 'text-orange-700' : 'text-stone-700'}`}>{cat.nome}</p>
                  {cat.descrizione && <p className="text-xs text-stone-400 truncate">{cat.descrizione}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); deleteCategoria(cat.id); }}
                    className="p-1 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className={selected?.id === cat.id ? 'text-orange-500' : 'text-stone-300'} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form nuovo listino */}
        {showNuova && (
          <div className="mt-4 bg-white rounded-xl border border-amber-300 p-4 space-y-3">
            <p className="text-xs font-bold text-stone-600 uppercase tracking-wide">Nuovo listino</p>
            <input
              value={nuovaNome}
              onChange={e => setNuovaNome(e.target.value)}
              placeholder="Nome (es. Ministero)"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              autoFocus
            />
            <input
              value={nuovaDesc}
              onChange={e => setNuovaDesc(e.target.value)}
              placeholder="Descrizione (opzionale)"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowNuova(false); setNuovaNome(''); setNuovaDesc(''); }} className="flex-1 py-2 text-xs font-semibold text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">Annulla</button>
              <button onClick={saveNuovaCategoria} disabled={savingNuova || !nuovaNome.trim()} className="flex-1 py-2 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">Salva</button>
            </div>
          </div>
        )}
      </div>

      {/* Colonna destra: prezzi per servizio */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-12 text-center h-full flex flex-col items-center justify-center">
            <List size={32} className="text-stone-300 mb-3" />
            <p className="text-stone-500 font-medium">Seleziona un listino</p>
            <p className="text-xs text-stone-400 mt-1">Scegli un listino a sinistra per impostare i prezzi</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <List size={15} className="text-orange-600" />
              </div>
              <div>
                <p className="font-bold text-stone-800">{selected.nome}</p>
                {selected.descrizione && <p className="text-xs text-stone-400">{selected.descrizione}</p>}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
              <p className="text-xs text-amber-700">
                Imposta il prezzo personalizzato per ogni servizio. I servizi senza prezzo impostato manterranno il prezzo standard in fiche.
              </p>
            </div>

            {loadingPrezzi ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : servizi.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-8">Nessun servizio o trattamento nel catalogo</p>
            ) : (
              <div className="space-y-5">
                {(['servizio', 'trattamento'] as const).map(tipo => {
                  const gruppo = servizi.filter(s => s.tipo === tipo);
                  if (gruppo.length === 0) return null;
                  return (
                    <div key={tipo}>
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                        {tipo === 'servizio' ? 'Servizi' : 'Trattamenti'}
                      </p>
                      <div className="overflow-x-auto">
                      {/* Header colonne */}
                      <div className="grid grid-cols-[minmax(100px,1fr)_100px_110px_70px] gap-2 px-4 py-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wide border-b border-stone-100 mb-1 min-w-[380px]">
                        <span>Voce</span>
                        <span className="text-right">Prezzo std</span>
                        <span className="text-right">Prezzo listino</span>
                        <span />
                      </div>
                      <div className="divide-y divide-stone-50 min-w-[380px]">
                        {gruppo.map(serv => {
                          const listinoPx = getPrezzoForServizio(serv.nome);
                          const isEditing = editingPrezzoId === serv.nome;
                          const hasPx = listinoPx !== null;
                          const risparmio = hasPx ? Math.max(0, serv.prezzo - (listinoPx as number)) : 0;
                          return (
                            <div key={serv.id} className={`grid grid-cols-[minmax(100px,1fr)_100px_110px_70px] gap-2 items-center px-4 py-3 transition-all ${hasPx ? 'bg-orange-50/60' : 'bg-white hover:bg-stone-50/50'}`}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-stone-800 truncate">{serv.nome}</p>
                                {hasPx && risparmio > 0 && (
                                  <p className="text-[10px] text-orange-500 font-medium mt-0.5">risparmio €{risparmio.toFixed(2)}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-medium ${hasPx && risparmio > 0 ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                                  €{serv.prezzo.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-right">
                                {isEditing ? (
                                  <div className="relative flex justify-end">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">€</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.5}
                                      value={editingVal}
                                      onChange={e => setEditingVal(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(serv.nome); if (e.key === 'Escape') setEditingPrezzoId(null); }}
                                      onBlur={() => commitEdit(serv.nome)}
                                      className="w-full border border-orange-400 rounded-lg pl-6 pr-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-300"
                                      autoFocus
                                      onFocus={e => e.target.select()}
                                    />
                                  </div>
                                ) : hasPx ? (
                                  <button
                                    onClick={() => startEdit(serv.nome)}
                                    className="text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                                    title="Clicca per modificare"
                                  >
                                    €{(listinoPx as number).toFixed(2)}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => startEdit(serv.nome)}
                                    className="text-xs font-medium text-stone-300 hover:text-amber-500 transition-colors border border-dashed border-stone-200 hover:border-amber-400 px-2 py-1 rounded-lg"
                                  >
                                    — imposta
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                {isEditing ? (
                                  <button onClick={() => commitEdit(serv.nome)} className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                                    <Check size={12} />
                                  </button>
                                ) : hasPx ? (
                                  <>
                                    <button onClick={() => startEdit(serv.nome)} className="p-1.5 rounded-lg hover:bg-orange-100 text-stone-300 hover:text-orange-600 transition-colors">
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={() => removePrezzo(serv.nome)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-200 hover:text-red-500 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>{/* end overflow-x-auto */}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Carte() {
  const [tab, setTab] = useState<Tab>('sconto');
  const [clienti, setClienti] = useState<Cliente[]>([]);

  useEffect(() => {
    dbSelect({ table: 'clienti', orderBy: [{ col: 'nome', asc: true }], columns: 'id, nome, cognome, telefono' }).then(({ data }) => {
      setClienti((data || []) as Cliente[]);
    });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800">Carte</h1>
            <p className="text-sm text-stone-400">Gestisci carte sconto, carte premium e Gift Pass</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit flex-wrap">
        <button
          onClick={() => setTab('sconto')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'sconto' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Tag size={15} />
          Carte sconto
        </button>
        <button
          onClick={() => setTab('premium')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'premium' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Star size={15} />
          Carte premium
        </button>
        <button
          onClick={() => setTab('gift')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'gift' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Gift size={15} />
          Gift Pass
        </button>
        <button
          onClick={() => setTab('listino')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === 'listino' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <List size={15} />
          Listini
        </button>
      </div>

      {tab === 'sconto' && <CarteSconto clienti={clienti} />}
      {tab === 'premium' && <CartePremium clienti={clienti} />}
      {tab === 'gift' && <GiftPassTab clienti={clienti} />}
      {tab === 'listino' && <ListinoTab />}
    </div>
  );
}
