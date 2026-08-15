import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, ChevronDown, User, ShieldOff, AlertTriangle } from 'lucide-react';
import { localDateStr, type Cliente, type TrattamentoCatalogo, type Parrucchiere, type StatoAppuntamento } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbDelete, dbSelectWithRelated } from '../lib/localDb';
import { useAuth } from '../lib/AuthContext';

interface ServizioRiga {
  parrucchiereId: string;
  trattamentoId: string;
  nomeTrattamento: string;
  prezzo: number;
  durataMinuti: number;
  orarioInizio: string; // HH:MM calcolato
}

interface Props {
  dataIniziale: Date;
  appuntamentoId?: string | null;
  parrucchiereId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function timeToDate(base: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export default function MultiBookModal({ dataIniziale, appuntamentoId, parrucchiereId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [catalogo, setCatalogo] = useState<TrattamentoCatalogo[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [blacklistWarning, setBlacklistWarning] = useState<{ motivo: string } | null>(null);

  // Data e ora selezionabili dall'utente
  const [dataSelezionata, setDataSelezionata] = useState(
    () => localDateStr(dataIniziale)
  );
  const [oraSelezionata, setOraSelezionata] = useState(
    () => `${String(dataIniziale.getHours()).padStart(2, '0')}:${String(dataIniziale.getMinutes()).padStart(2, '0')}`
  );
  const orarioBase = oraSelezionata;

  // Cliente: può essere un ID esistente oppure un nome libero
  const [clienteId, setClienteId] = useState('');       // ID se da archivio
  const [clienteInput, setClienteInput] = useState(''); // testo digitato
  const [clienteSuggerimenti, setClienteSuggerimenti] = useState<Cliente[]>([]);
  const [clienteDropOpen, setClienteDropOpen] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);

  const [stato, setStato] = useState<StatoAppuntamento>('confermato');
  const [note, setNote] = useState('');
  const [righe, setRighe] = useState<ServizioRiga[]>([
    { parrucchiereId: parrucchiereId ?? '', trattamentoId: '', nomeTrattamento: '', prezzo: 0, durataMinuti: 30, orarioInizio: orarioBase },
  ]);

  // openParr[i] = true => dropdown parrucchieri aperto per riga i
  const [openParr, setOpenParr] = useState<boolean[]>([false]);
  const [openServ, setOpenServ] = useState<boolean[]>([false]);

  useEffect(() => {
    async function load() {
      const [parrRes, catRes, clRes] = await Promise.all([
        dbSelect<Parrucchiere>({
          table: 'parrucchieri',
          filters: [{ col: 'attivo', op: 'eq', val: true }],
          orderBy: [{ col: 'nome' }],
        }),
        dbSelect<TrattamentoCatalogo>({
          table: 'trattamenti_catalogo',
          filters: [{ col: 'attivo', op: 'eq', val: true }],
          orderBy: [{ col: 'nome' }],
        }),
        dbSelect<Cliente>({
          table: 'clienti',
          columns: 'id, nome, cognome, in_blacklist, motivo_blacklist',
          filters: [{ col: 'deleted_at', op: 'is_null', val: null }],
          orderBy: [{ col: 'cognome' }],
        }),
      ]);
      setParrucchieri(parrRes.data || []);
      setCatalogo(catRes.data || []);
      setClienti(clRes.data || []);

      if (appuntamentoId) {
        const appRes = await dbSelectWithRelated<any>({
          table: 'appuntamenti',
          filters: [{ col: 'id', op: 'eq', val: appuntamentoId }],
          relations: [
            { key: 'clienti', table: 'clienti', fk: 'cliente_id' },
            { key: 'appuntamento_trattamenti', table: 'appuntamento_trattamenti', fk: 'appuntamento_id', many: true },
          ],
          supabaseSelect: '*, clienti(id, nome, cognome), appuntamento_trattamenti(*)',
        });
        const app = appRes.data?.[0];
        if (app) {
          const d = new Date(app.data_ora);
          const dataStr = localDateStr(d);
          const oraStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          setDataSelezionata(dataStr);
          setOraSelezionata(oraStr);
          if (app.clienti) {
            const c = app.clienti as { id: string; nome: string; cognome: string };
            setClienteId(c.id);
            setClienteInput(`${c.nome} ${c.cognome}`);
          }
          if (app.stato) setStato(app.stato as StatoAppuntamento);
          if (app.note) setNote(app.note);
          const tratt = (app.appuntamento_trattamenti || []) as {
            trattamento_id: string; nome_trattamento: string; prezzo: number; durataMinuti?: number;
          }[];
          if (tratt.length > 0) {
            // Per ogni trattamento, recupera durata dal catalogo
            const catData = catRes.data || [];
            let cursor = oraStr;
            const rows: ServizioRiga[] = tratt.map(t => {
              const catItem = catData.find(c => c.id === t.trattamento_id);
              const durata = catItem?.durata_minuti ?? app.durata_minuti ?? 60;
              const start = cursor;
              cursor = addMinutes(cursor, durata);
              return {
                parrucchiereId: app.parrucchiere_id ?? '',
                trattamentoId: t.trattamento_id ?? '',
                nomeTrattamento: t.nome_trattamento,
                prezzo: t.prezzo,
                durataMinuti: durata,
                orarioInizio: start,
              };
            });
            setRighe(rows);
            setOpenParr(rows.map(() => false));
            setOpenServ(rows.map(() => false));
          } else {
            // nessun trattamento — popola almeno parrucchiere e durata
            setRighe([{
              parrucchiereId: app.parrucchiere_id ?? '',
              trattamentoId: '',
              nomeTrattamento: '',
              prezzo: 0,
              durataMinuti: app.durata_minuti ?? 60,
              orarioInizio: oraStr,
            }]);
          }
        }
      }
    }
    load();
  }, [appuntamentoId]);

  function recalcOrari(rows: ServizioRiga[], base: string = orarioBase): ServizioRiga[] {
    let cursor = base;
    return rows.map((r, i) => {
      if (i === 0) {
        const updated = { ...r, orarioInizio: base };
        cursor = addMinutes(base, r.durataMinuti);
        return updated;
      }
      const updated = { ...r, orarioInizio: cursor };
      cursor = addMinutes(cursor, r.durataMinuti);
      return updated;
    });
  }

  function updateRiga(idx: number, patch: Partial<ServizioRiga>) {
    setRighe(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, ...patch } : r);
      return recalcOrari(next);
    });
  }

  function addRiga() {
    setRighe(prev => {
      const last = prev[prev.length - 1];
      const orario = last ? addMinutes(last.orarioInizio, last.durataMinuti) : orarioBase;
      const defaultParr = prev[0]?.parrucchiereId ?? '';
      const next = [...prev, { parrucchiereId: defaultParr, trattamentoId: '', nomeTrattamento: '', prezzo: 0, durataMinuti: 30, orarioInizio: orario }];
      return recalcOrari(next);
    });
    setOpenParr(p => [...p, false]);
    setOpenServ(p => [...p, false]);
  }

  function handleOraChange(newOra: string) {
    setOraSelezionata(newOra);
    setRighe(prev => recalcOrari(prev, newOra));
  }

  function removeRiga(idx: number) {
    setRighe(prev => recalcOrari(prev.filter((_, i) => i !== idx)));
    setOpenParr(p => p.filter((_, i) => i !== idx));
    setOpenServ(p => p.filter((_, i) => i !== idx));
  }

  function toggleParr(idx: number) {
    setOpenParr(p => p.map((v, i) => i === idx ? !v : false));
    setOpenServ(p => p.map(() => false));
  }

  function toggleServ(idx: number) {
    setOpenServ(p => p.map((v, i) => i === idx ? !v : false));
    setOpenParr(p => p.map(() => false));
  }

  function closeAll() {
    setOpenParr(p => p.map(() => false));
    setOpenServ(p => p.map(() => false));
    setClienteDropOpen(false);
  }

  function onClienteInput(val: string) {
    setClienteInput(val);
    setClienteId(''); // reset selezione quando si digita
    if (val.trim().length === 0) {
      setClienteSuggerimenti([]);
      setClienteDropOpen(false);
      return;
    }
    const q = val.toLowerCase();
    const found = clienti.filter(c =>
      `${c.nome} ${c.cognome}`.toLowerCase().includes(q) ||
      `${c.cognome} ${c.nome}`.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aS = a.nome.toLowerCase().startsWith(q) || a.cognome.toLowerCase().startsWith(q);
      const bS = b.nome.toLowerCase().startsWith(q) || b.cognome.toLowerCase().startsWith(q);
      return aS === bS ? 0 : aS ? -1 : 1;
    }).slice(0, 6);
    setClienteSuggerimenti(found);
    setClienteDropOpen(true);
  }

  async function selectCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteInput(`${c.nome} ${c.cognome}`);
    setClienteDropOpen(false);
    // Verifica blacklist fresca dal DB (fallback ai dati in memoria se offline)
    const { data } = await dbSelect<Cliente>({
      table: 'clienti',
      columns: 'in_blacklist, motivo_blacklist',
      filters: [{ col: 'id', op: 'eq', val: c.id }],
      limit: 1,
    });
    const checked = data?.[0] ?? c;
    if (checked.in_blacklist) {
      setBlacklistWarning({ motivo: checked.motivo_blacklist || '' });
    } else {
      setBlacklistWarning(null);
    }
  }

  async function handleSave() {
    if (!clienteInput.trim()) { setError('Inserisci il nome del cliente'); return; }
    const invalid = righe.find(r => !r.parrucchiereId || !r.trattamentoId);
    if (invalid) { setError('Seleziona parrucchiere e servizio per ogni riga'); return; }
    setSaving(true);
    setError('');

    // Risolvi cliente
    let resolvedClienteId = clienteId;
    if (!resolvedClienteId) {
      const parts = clienteInput.trim().split(/\s+/);
      const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const nome = cap(parts[0] ?? '');
      const lastPart = parts[parts.length - 1] ?? '';
      const isPhone = parts.length >= 3 && /^[+\d]{6,15}$/.test(lastPart);
      const cognome = cap(isPhone ? parts.slice(1, -1).join(' ') : parts.slice(1).join(' '));
      const telefono = isPhone ? lastPart : undefined;
      const nuovoClienteRes = await dbInsert<any>({
        table: 'clienti',
        data: { nome, cognome, ...(telefono ? { telefono } : {}), user_id: user?.id },
      });
      if (!nuovoClienteRes.data?.id) {
        setError('Errore nella creazione del cliente');
        setSaving(false);
        return;
      }
      resolvedClienteId = nuovoClienteRes.data.id;
    }

    if (appuntamentoId) {
      // MODIFICA: aggiorna l'appuntamento esistente
      const firstRow = righe.reduce((a, b) => a.orarioInizio < b.orarioInizio ? a : b);
      const baseDate = new Date(dataSelezionata + 'T00:00:00');
      const data_ora = timeToDate(baseDate, firstRow.orarioInizio).toISOString();
      const durata_totale = righe.reduce((s, r) => s + r.durataMinuti, 0);
      const prezzo_totale = righe.reduce((s, r) => s + r.prezzo, 0);
      await dbUpdate({
        table: 'appuntamenti',
        id: appuntamentoId,
        data: {
          cliente_id: resolvedClienteId,
          parrucchiere_id: righe[0]?.parrucchiereId || null,
          data_ora,
          durata_minuti: durata_totale,
          stato,
          note,
          prezzo_totale,
          updated_at: new Date().toISOString(),
        },
      });
      await dbDelete({
        table: 'appuntamento_trattamenti',
        filters: [{ col: 'appuntamento_id', op: 'eq', val: appuntamentoId }],
      });
      for (const r of righe) {
        await dbInsert({
          table: 'appuntamento_trattamenti',
          data: {
            appuntamento_id: appuntamentoId,
            trattamento_id: r.trattamentoId || null,
            nome_trattamento: r.nomeTrattamento,
            prezzo: r.prezzo,
            user_id: user?.id,
          },
        });
      }
    } else {
      // NUOVO: raggruppa per parrucchiere
      const byParr: Record<string, ServizioRiga[]> = {};
      for (const r of righe) {
        if (!byParr[r.parrucchiereId]) byParr[r.parrucchiereId] = [];
        byParr[r.parrucchiereId].push(r);
      }
      for (const [parrId, rows] of Object.entries(byParr)) {
        const firstRow = rows.reduce((a, b) => a.orarioInizio < b.orarioInizio ? a : b);
        const baseDate = new Date(dataSelezionata + 'T00:00:00');
        const data_ora = timeToDate(baseDate, firstRow.orarioInizio).toISOString();
        const durata_totale = rows.reduce((s, r) => s + r.durataMinuti, 0);
        const prezzo_totale = rows.reduce((s, r) => s + r.prezzo, 0);
        const appRes = await dbInsert<any>({
          table: 'appuntamenti',
          data: {
            cliente_id: resolvedClienteId,
            parrucchiere_id: parrId,
            data_ora,
            durata_minuti: durata_totale,
            stato,
            note,
            prezzo_totale,
            user_id: user?.id,
          },
        });
        if (appRes.data?.id) {
          for (const r of rows) {
            await dbInsert({
              table: 'appuntamento_trattamenti',
              data: {
                appuntamento_id: appRes.data.id,
                trattamento_id: r.trattamentoId,
                nome_trattamento: r.nomeTrattamento,
                prezzo: r.prezzo,
                user_id: user?.id,
              },
            });
          }
        }
      }
    }

    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (!appuntamentoId) return;
    setDeleting(true);
    await dbUpdate({ table: 'appuntamenti', id: appuntamentoId, data: { deleted_at: new Date().toISOString() } });
    setDeleting(false);
    onSaved();
  }

  const totale = righe.reduce((s, r) => s + r.prezzo, 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeAll}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-stone-800 text-lg">{appuntamentoId ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input
                type="date"
                value={dataSelezionata}
                onChange={e => setDataSelezionata(e.target.value)}
                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              />
              <span className="text-stone-300 text-sm">·</span>
              <input
                type="time"
                value={oraSelezionata}
                onChange={e => handleOraChange(e.target.value)}
                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
              />
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors ml-4 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Avviso blacklist */}
          {blacklistWarning && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex gap-3">
              <ShieldOff size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700">Cliente in lista nera</p>
                {blacklistWarning.motivo && (
                  <p className="text-xs text-red-600 mt-0.5">{blacklistWarning.motivo}</p>
                )}
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Puoi comunque procedere con la prenotazione.
                </p>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div ref={clienteRef} className="relative">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Cliente *</label>
            <div className="relative">
              <input
                type="text"
                autoComplete="off"
                value={clienteInput}
                onChange={e => onClienteInput(e.target.value)}
                onFocus={() => {
                  if (clienteInput.trim()) setClienteDropOpen(true);
                }}
                onBlur={() => setTimeout(() => setClienteDropOpen(false), 150)}
                placeholder="Scrivi nome o cognome..."
                className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
                  clienteId ? 'border-amber-300 bg-amber-50' : 'border-stone-200'
                }`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <User size={13} className={clienteId ? 'text-amber-500' : 'text-stone-400'} />
              </div>
              {clienteId && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </div>
            {clienteDropOpen && clienteSuggerimenti.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-40 overflow-hidden">
                {clienteSuggerimenti.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); selectCliente(c); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${c.in_blacklist ? 'hover:bg-red-50' : 'hover:bg-amber-50'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${c.in_blacklist ? 'bg-red-100' : 'bg-amber-100'}`}>
                      {c.in_blacklist ? (
                        <ShieldOff size={12} className="text-red-500" />
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700">
                          {c.nome[0]}{c.cognome[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${c.in_blacklist ? 'text-red-700' : 'text-stone-800'}`}>{c.nome} {c.cognome}</p>
                      <p className="text-[10px] text-stone-400">{c.in_blacklist ? 'Lista nera' : 'Archivio clienti'}</p>
                    </div>
                  </button>
                ))}
                {/* Opzione usa nome libero */}
                <div className="border-t border-stone-100">
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); setClienteId(''); setClienteDropOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <Plus size={11} className="text-stone-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-700">Usa "{clienteInput}"</p>
                      <p className="text-[10px] text-stone-400">Nuovo cliente — aggiungi telefono dopo il cognome</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
            {clienteDropOpen && clienteSuggerimenti.length === 0 && clienteInput.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-40 overflow-hidden">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); setClienteDropOpen(false); }}
                  className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={11} className="text-stone-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-700">"{clienteInput}" — nuovo cliente</p>
                    <p className="text-[10px] text-stone-400">Scheda creata al salvataggio — puoi aggiungere il telefono dopo il cognome</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Servizi */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wide">Servizi</label>
            <div className="space-y-3">
              {righe.map((riga, idx) => {
                const parrSelezionato = parrucchieri.find(p => p.id === riga.parrucchiereId);
                const servSelezionato = catalogo.find(c => c.id === riga.trattamentoId);
                const fineOrario = addMinutes(riga.orarioInizio, riga.durataMinuti);

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-stone-200 overflow-visible"
                    style={{ borderColor: parrSelezionato ? `${parrSelezionato.colore}60` : undefined }}
                  >
                    {/* Riga header */}
                    <div
                      className="px-3 py-2 flex items-center gap-1 rounded-t-xl"
                      style={{ backgroundColor: parrSelezionato ? `${parrSelezionato.colore}12` : '#f9f9f8' }}
                    >
                      <span className="text-xs font-bold text-stone-400 w-5">{idx + 1}</span>
                      <span className="text-xs font-semibold ml-auto mr-2" style={{ color: parrSelezionato?.colore || '#a8a29e' }}>
                        {riga.orarioInizio} → {fineOrario}
                      </span>
                      {righe.length > 1 && (
                        <button onClick={() => removeRiga(idx)} className="text-stone-300 hover:text-red-400 transition-colors ml-1">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2">
                      {/* Parrucchiere selector */}
                      <div className="relative">
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1 uppercase tracking-wide">Parrucchiere</label>
                        <button
                          type="button"
                          onClick={() => toggleParr(idx)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
                          style={{
                            borderColor: parrSelezionato ? parrSelezionato.colore : '#e7e5e4',
                            backgroundColor: parrSelezionato ? `${parrSelezionato.colore}10` : '#fafaf9',
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {parrSelezionato
                              ? <><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: parrSelezionato.colore }} /><span className="font-medium truncate" style={{ color: parrSelezionato.colore }}>{parrSelezionato.nome}</span></>
                              : <span className="text-stone-400">Scegli...</span>
                            }
                          </div>
                          <ChevronDown size={12} className="text-stone-400 flex-shrink-0" />
                        </button>
                        {openParr[idx] && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 overflow-hidden">
                            {parrucchieri.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => { updateRiga(idx, { parrucchiereId: p.id }); toggleParr(idx); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors text-left"
                              >
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                                <span className="text-sm font-medium text-stone-700">{p.nome}</span>
                                {riga.parrucchiereId === p.id && <span className="ml-auto text-xs" style={{ color: p.colore }}>✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Servizio selector */}
                      <div className="relative">
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1 uppercase tracking-wide">Servizio</label>
                        <button
                          type="button"
                          onClick={() => toggleServ(idx)}
                          className="w-full flex items-center justify-between gap-1 px-3 py-2 rounded-lg border text-sm transition-all bg-stone-50 border-stone-200 hover:border-amber-300 min-h-[36px]"
                        >
                          {servSelezionato ? (
                            <span className="font-medium text-stone-800 text-left leading-tight break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {servSelezionato.nome}
                            </span>
                          ) : (
                            <span className="text-stone-400">Scegli...</span>
                          )}
                          <ChevronDown size={12} className="text-stone-400 flex-shrink-0 ml-1" />
                        </button>
                        {openServ[idx] && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-52 overflow-y-auto" style={{ minWidth: 'max(100%, 180px)', right: 'auto' }}>
                            {catalogo.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  updateRiga(idx, {
                                    trattamentoId: cat.id,
                                    nomeTrattamento: cat.nome,
                                    prezzo: cat.prezzo,
                                    durataMinuti: cat.durata_minuti,
                                  });
                                  toggleServ(idx);
                                }}
                                className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors text-left"
                              >
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: cat.colore }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-stone-800 leading-tight">{cat.nome}</p>
                                  <p className="text-xs text-stone-400 mt-0.5">{cat.durata_minuti}min · <span className="font-semibold text-stone-600">€{cat.prezzo.toFixed(0)}</span></p>
                                </div>
                                {riga.trattamentoId === cat.id && <span className="text-amber-500 text-xs font-bold flex-shrink-0 mt-0.5">✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Durata override */}
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1 uppercase tracking-wide">Durata (min)</label>
                        <input
                          type="number"
                          onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                          min={5}
                          step={5}
                          value={riga.durataMinuti}
                          onChange={e => updateRiga(idx, { durataMinuti: parseInt(e.target.value) || 15 })}
                          onFocus={e => e.target.select()}
                          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>

                      {/* Prezzo */}
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1 uppercase tracking-wide">Prezzo (€)</label>
                        <input
                          type="number"
                          onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                          min={0}
                          step={0.5}
                          value={riga.prezzo}
                          onChange={e => updateRiga(idx, { prezzo: parseFloat(e.target.value) || 0 })}
                          onFocus={e => e.target.select()}
                          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRiga}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-200 text-sm font-medium text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
            >
              <Plus size={14} />
              Aggiungi servizio
            </button>
          </div>

          {/* Stato + Note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Stato</label>
              <select
                value={stato}
                onChange={e => setStato(e.target.value as StatoAppuntamento)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="in_forse">In forse</option>
                <option value="confermato">Confermato</option>
                <option value="in_attesa">In attesa</option>
                <option value="completato">Completato</option>
                <option value="cancellato">Cancellato</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Opzionale…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Totale */}
          {totale > 0 && (
            <div className="flex justify-end">
              <span className="text-sm font-bold text-stone-800">Totale: €{totale.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex-shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-3 justify-between flex-wrap gap-y-2">
              <span className="text-sm text-red-700 font-medium">Eliminare definitivamente?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {deleting ? 'Eliminazione...' : 'Si, elimina'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 justify-between">
              {appuntamentoId ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Elimina
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvataggio...' : 'Salva appuntamento'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
