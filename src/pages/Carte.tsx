import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard, Plus, Trash2, X, ChevronDown, Search, Tag, Star,
  RefreshCw, Check, Copy, AlertCircle, Wallet, History, Percent, Euro,
} from 'lucide-react';
import { localDateStr } from '../lib/supabase';
import PasswordGateModal from '../components/PasswordGateModal';
import SmsCartaModal, { type AzioneCarta } from '../components/SmsCartaModal';
import { useAuth } from '../lib/AuthContext';
import { dbSelect, dbSelectWithRelated, dbInsert, dbUpdate, dbDelete } from '../lib/localDb';

type TipoPagamento = 'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartaSconto {
  id: string;
  codice: string;
  descrizione: string;
  tipo_sconto: 'percentuale' | 'fisso';
  valore_sconto: number;
  attiva: boolean;
  usa_e_getta: boolean;
  nominativa: boolean;
  cliente_id: string | null;
  telefono_override: string;
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

type Tab = 'sconto' | 'premium';

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
  onSaved: (info: { codice: string; tipoSconto: 'percentuale' | 'fisso'; valoreSconto: number; cliente: Cliente | null; telefonoOverride: string }) => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    codice: genCodice('SCONTO'),
    descrizione: '',
    tipo_sconto: 'percentuale' as 'percentuale' | 'fisso',
    valore_sconto: 10,
    usa_e_getta: true,
    cliente_id: '',
    telefono_override: '',
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const clienteSelezionato = clienti.find(c => c.id === form.cliente_id) ?? null;
  const clienteHaTelefono = !!clienteSelezionato?.telefono?.trim();
  const mostraTelefonoManuale = !clienteSelezionato || !clienteHaTelefono;
  const isNominativa = !form.usa_e_getta && !!form.cliente_id;

  async function save() {
    setSaving(true);
    await dbInsert({ table: 'carte_sconto', data: {
      codice: form.codice,
      descrizione: form.descrizione,
      tipo_sconto: form.tipo_sconto,
      valore_sconto: form.valore_sconto,
      usa_e_getta: form.usa_e_getta,
      cliente_id: form.cliente_id || null,
      telefono_override: form.telefono_override.trim(),
      nominativa: isNominativa,
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
                onChange={e => setForm(f => ({ ...f, tipo_sconto: e.target.value as 'percentuale' | 'fisso' }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                <option value="percentuale">Percentuale (%)</option>
                <option value="fisso">Importo fisso (€)</option>
              </select>
            </div>
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
          </div>

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
          <button onClick={save} disabled={saving || !form.codice} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
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
      note: form.note,
      user_id: user?.id,
    }});
    const cartaId = (data as any)?.id;
    if (cartaId && form.importo_iniziale > 0) {
      await dbInsert({ table: 'ricariche_carta_premium', data: {
        carta_premium_id: cartaId,
        importo: form.importo_iniziale,
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
      carta_premium_id: carta.id, importo, note, tipo_ricarica: tipo, user_id: user?.id,
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
    await dbUpdate({ table: 'carte_sconto', id: carta.id, data: { attiva: !carta.attiva } });
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
    const matchStato = filtroStato === 'tutte' || (filtroStato === 'attive' ? c.attiva : !c.attiva);
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
          { label: 'Attive', value: carte.filter(c => c.attiva).length, color: 'text-emerald-600' },
          { label: 'Disattive', value: carte.filter(c => !c.attiva).length, color: 'text-red-500' },
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
              ? (carta.attiva ? 'bg-rose-100' : 'bg-stone-100')
              : (carta.attiva ? 'bg-teal-100' : 'bg-stone-100');
            const iconColor = isUsaGetta
              ? (carta.attiva ? 'text-rose-600' : 'text-stone-400')
              : (carta.attiva ? 'text-teal-600' : 'text-stone-400');
            const scontoColor = isUsaGetta
              ? (carta.attiva ? 'text-rose-600' : 'text-stone-400')
              : (carta.attiva ? 'text-teal-600' : 'text-stone-400');

            return (
              <div key={carta.id} className={`rounded-2xl border p-4 transition-all ${carta.attiva ? accentActive : accentInactive}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                      {carta.tipo_sconto === 'percentuale'
                        ? <Percent size={18} className={iconColor} />
                        : <Euro size={18} className={iconColor} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copyCodice(carta.codice)} className="font-mono text-sm font-bold text-stone-800 hover:text-amber-600 transition-colors flex items-center gap-1">
                          {carta.codice}
                          {copied === carta.codice ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="text-stone-300" />}
                        </button>
                        {!carta.attiva && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Disattiva</span>}
                        {isUsaGetta
                          ? <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-semibold">Usa e getta</span>
                          : <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">Riutilizzabile</span>
                        }
                        {carta.nominativa && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Nominativa</span>}
                      </div>
                      {carta.descrizione && <p className="text-xs text-stone-500 mt-0.5">{carta.descrizione}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-sm font-bold ${scontoColor}`}>
                          {carta.tipo_sconto === 'percentuale' ? `${carta.valore_sconto}%` : `€${fmt(carta.valore_sconto)}`} di sconto
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
                    <button onClick={() => toggleAttiva(carta)} className={`p-2 rounded-lg transition-colors ${carta.attiva ? 'hover:bg-red-50 text-stone-400 hover:text-red-500' : 'hover:bg-emerald-50 text-stone-400 hover:text-emerald-500'}`} title={carta.attiva ? 'Disattiva' : 'Attiva'}>
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
    await dbUpdate({ table: 'carte_premium', id: carta.id, data: { attiva: !carta.attiva } });
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
          { label: 'Carte attive', value: carte.filter(c => c.attiva).length, display: String(carte.filter(c => c.attiva).length), color: 'text-emerald-600' },
          { label: 'Saldo totale', value: saldoTotale, display: `€${fmt(saldoTotale)}`, color: 'text-stone-700' },
          { label: 'Carte esaurite', value: carte.filter(c => c.saldo <= 0 && c.attiva).length, display: String(carte.filter(c => c.saldo <= 0 && c.attiva).length), color: 'text-amber-600' },
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
            const esauritaDisattiva = !carta.attiva && saldoEsaurito;
            return (
              <div key={carta.id} className={`bg-white rounded-2xl border p-4 transition-all ${esauritaDisattiva ? 'border-red-200 opacity-70' : !carta.attiva ? 'border-stone-100 opacity-60' : saldoEsaurito ? 'border-red-200' : saldoBasso ? 'border-amber-200' : 'border-stone-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${esauritaDisattiva ? 'bg-red-100' : !carta.attiva ? 'bg-stone-100' : saldoEsaurito ? 'bg-red-100' : 'bg-emerald-100'}`}>
                      <Star size={18} className={esauritaDisattiva ? 'text-red-500' : !carta.attiva ? 'text-stone-400' : saldoEsaurito ? 'text-red-500' : 'text-emerald-600'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copyCodice(carta.codice)} className="font-mono text-sm font-bold text-stone-800 hover:text-emerald-600 transition-colors flex items-center gap-1">
                          {carta.codice}
                          {copied === carta.codice ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="text-stone-300" />}
                        </button>
                        {!carta.attiva && !saldoEsaurito && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-semibold">Disattiva</span>}
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
                    <button onClick={() => toggleAttiva(carta)} className={`p-2 rounded-lg transition-colors ${carta.attiva ? 'hover:bg-red-50 text-stone-400 hover:text-red-500' : 'hover:bg-emerald-50 text-stone-400 hover:text-emerald-500'}`}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

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
            <p className="text-sm text-stone-400">Gestisci carte sconto e carte premium ricaricabili</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit">
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
      </div>

      {tab === 'sconto' && <CarteSconto clienti={clienti} />}
      {tab === 'premium' && <CartePremium clienti={clienti} />}
    </div>
  );
}
