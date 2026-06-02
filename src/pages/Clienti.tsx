import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Phone, Mail, ChevronRight, Trash2, Users, CreditCard, ClipboardList, Check, X, UserPlus, Clock, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { supabase, type Cliente } from '../lib/supabase';
import ClienteModal from '../components/ClienteModal';
import PasswordGateModal from '../components/PasswordGateModal';
import { useAuth } from '../lib/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  onSelectCliente: (id: string) => void;
}

interface SchedaDaConfermare {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  data_nascita: string | null;
  note: string;
  stato: string;
  created_at: string;
}

export default function Clienti({ onSelectCliente }: Props) {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [clientiConCarte, setClientiConCarte] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'clienti' | 'da_confermare'>('clienti');
  const [schede, setSchede] = useState<SchedaDaConfermare[]>([]);
  const [schedeLoading, setSchedeLoading] = useState(false);
  const [schedaAperta, setSchedaAperta] = useState<SchedaDaConfermare | null>(null);
  const [confermando, setConfermando] = useState<string | null>(null);
  const [eliminaGate, setEliminaGate] = useState<string | null>(null);
  const [eliminaClienteGate, setEliminaClienteGate] = useState<string | null>(null);

  const loadClienti = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: sc }, { data: pr }] = await Promise.all([
      supabase.from('clienti').select('*').is('deleted_at', null).order('cognome').order('nome'),
      supabase.from('carte_sconto').select('cliente_id').not('cliente_id', 'is', null),
      supabase.from('carte_premium').select('cliente_id'),
    ]);
    setClienti((data || []) as Cliente[]);
    const ids = new Set<string>();
    for (const r of [...(sc || []), ...(pr || [])]) {
      if (r.cliente_id) ids.add(r.cliente_id);
    }
    setClientiConCarte(ids);
    setLoading(false);
  }, []);

  const loadSchede = useCallback(async () => {
    setSchedeLoading(true);
    const { data } = await supabase
      .from('schede_clienti_da_confermare')
      .select('*')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    setSchede((data || []) as SchedaDaConfermare[]);
    setSchedeLoading(false);
  }, []);

  useEffect(() => { loadClienti(); }, [loadClienti]);
  useEffect(() => { if (tab === 'da_confermare') loadSchede(); }, [tab, loadSchede]);

  async function deleteCliente(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEliminaClienteGate(id);
  }

  async function eseguiEliminaCliente(id: string) {
    await supabase.from('clienti').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setEliminaClienteGate(null);
    loadClienti();
  }

  async function confermaScheda(scheda: SchedaDaConfermare) {
    setConfermando(scheda.id);
    const { data, error } = await supabase.from('clienti').insert({
      nome: scheda.nome,
      cognome: scheda.cognome,
      telefono: scheda.telefono || '',
      email: scheda.email || '',
      data_nascita: scheda.data_nascita || null,
      note: scheda.note || '',
      foto_url: '',
      user_id: user?.id,
    }).select('id').maybeSingle();

    if (!error && data) {
      await supabase.from('schede_clienti_da_confermare').update({ stato: 'confermato' }).eq('id', scheda.id);
      setSchedaAperta(null);
      loadSchede();
      loadClienti();
      onSelectCliente(data.id);
    }
    setConfermando(null);
  }

  async function eliminaScheda(id: string) {
    await supabase.from('schede_clienti_da_confermare').delete().eq('id', id);
    setEliminaGate(null);
    setSchedaAperta(null);
    loadSchede();
  }

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  function calcEta(dataNascita: string | null) {
    if (!dataNascita) return '';
    const diff = Date.now() - new Date(dataNascita).getTime();
    return String(Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
  }

  function esportaExcel() {
    setExporting(true);
    const header = ['Cognome', 'Nome', 'Telefono', 'Email', 'Data nascita', 'Eta', 'Note'];
    const rows = clienti.map(c => [
      c.cognome, c.nome, c.telefono ?? '', c.email ?? '',
      c.data_nascita ?? '', calcEta(c.data_nascita ?? null), (c.note ?? '').replace(/\n/g, ' '),
    ]);
    const csvContent = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clienti-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    setExportOpen(false);
  }

  function esportaPDF() {
    setExporting(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Elenco Clienti', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Esportato il ${new Date().toLocaleDateString('it-IT')} — ${clienti.length} clienti`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Cognome', 'Nome', 'Telefono', 'Email', 'Data nascita', 'Eta', 'Note']],
      body: clienti.map(c => [
        c.cognome, c.nome, c.telefono ?? '', c.email ?? '',
        c.data_nascita ? new Date(c.data_nascita).toLocaleDateString('it-IT') : '',
        calcEta(c.data_nascita ?? null),
        (c.note ?? '').slice(0, 60),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 6: { cellWidth: 50 } },
    });

    doc.save(`clienti-${new Date().toISOString().slice(0, 10)}.pdf`);
    setExporting(false);
    setExportOpen(false);
  }

  const filtered = clienti.filter(c => {
    const q = query.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      c.cognome.toLowerCase().includes(q) ||
      c.telefono.includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce<Record<string, Cliente[]>>((acc, c) => {
    const letter = c.cognome[0]?.toUpperCase() ?? '#';
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(c);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-stone-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('clienti')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'clienti' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <Users size={15} />
          Clienti
          {clienti.length > 0 && (
            <span className="text-xs bg-stone-200 text-stone-600 rounded-full px-2 py-0.5">{clienti.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('da_confermare')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'da_confermare' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <ClipboardList size={15} />
          Schede da confermare
          {schede.length > 0 && (
            <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">{schede.length}</span>
          )}
        </button>
      </div>

      {tab === 'clienti' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Cerca per nome, cognome, telefono..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>

            {/* Export dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setExportOpen(v => !v)}
                disabled={exporting || clienti.length === 0}
                className="flex items-center gap-2 border border-stone-200 bg-white text-stone-700 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-40"
              >
                <FileSpreadsheet size={15} />
                Esporta
                <ChevronDown size={13} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5 min-w-[170px]">
                    <button
                      onClick={esportaExcel}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet size={15} className="text-emerald-600" />
                      <span>Scarica Excel (.csv)</span>
                    </button>
                    <button
                      onClick={esportaPDF}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileText size={15} className="text-red-500" />
                      <span>Scarica PDF</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors flex-shrink-0"
            >
              <Plus size={16} /> Nuovo cliente
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-2 mb-5">
            <Users size={14} className="text-stone-400" />
            <span className="text-sm text-stone-500">
              {filtered.length} {filtered.length === 1 ? 'cliente' : 'clienti'}
              {query && ` su ${clienti.length} totali`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-16 text-center">
              <Users size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessun cliente trovato</p>
              {!query && <p className="text-stone-400 text-sm mt-1">Aggiungi il primo cliente usando il pulsante in alto</p>}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(grouped).sort().map(letter => (
                <div key={letter}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{letter}</span>
                    <div className="flex-1 h-px bg-stone-100" />
                  </div>
                  <div className="space-y-2">
                    {grouped[letter].map(c => (
                      <div
                        key={c.id}
                        onClick={() => onSelectCliente(c.id)}
                        className="bg-white rounded-xl border border-stone-200 px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all group"
                      >
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-amber-700">
                            {c.nome[0]?.toUpperCase()}{c.cognome[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">
                              {c.cognome} {c.nome}
                            </p>
                            {clientiConCarte.has(c.id) && (
                              <CreditCard size={13} className="text-amber-500 flex-shrink-0" title="Ha carte attive" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-0.5">
                            {c.telefono && (
                              <span className="flex items-center gap-1 text-xs text-stone-400">
                                <Phone size={10} /> {c.telefono}
                              </span>
                            )}
                            {c.email && (
                              <span className="flex items-center gap-1 text-xs text-stone-400">
                                <Mail size={10} /> {c.email}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.data_nascita && (
                          <span className="text-xs text-stone-400 flex-shrink-0">
                            {Math.floor((Date.now() - new Date(c.data_nascita).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} anni
                          </span>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={e => deleteCliente(c.id, e)}
                            className="p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className="text-stone-300 group-hover:text-amber-500 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'da_confermare' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-stone-500">
              Schede inviate dalle clienti tramite il form QR — confermale per creare la scheda cliente.
            </p>
            <button
              onClick={loadSchede}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              Aggiorna
            </button>
          </div>

          {schedeLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : schede.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-16 text-center">
              <ClipboardList size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessuna scheda in attesa</p>
              <p className="text-stone-400 text-sm mt-1">Le nuove schede inviate tramite QR appariranno qui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schede.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSchedaAperta(s)}
                  className="bg-white rounded-xl border border-amber-200 px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserPlus size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">
                      {s.cognome} {s.nome}
                    </p>
                    <div className="flex items-center gap-4 mt-0.5">
                      {s.telefono && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Phone size={10} /> {s.telefono}
                        </span>
                      )}
                      {s.email && (
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Mail size={10} /> {s.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <Clock size={10} />
                      {new Date(s.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">In attesa</span>
                    <button
                      onClick={e => { e.stopPropagation(); setEliminaGate(s.id); }}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Elimina scheda"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-stone-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <ClienteModal
          onClose={() => setShowModal(false)}
          onSaved={id => { setShowModal(false); loadClienti(); onSelectCliente(id); }}
        />
      )}

      {/* Modal dettaglio scheda da confermare */}
      {schedaAperta && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <UserPlus size={18} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-800">Nuova scheda cliente</h2>
                  <p className="text-xs text-stone-400">Inviata tramite form QR</p>
                </div>
              </div>
              <button onClick={() => setSchedaAperta(null)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                <X size={16} className="text-stone-500" />
              </button>
            </div>

            {/* Dati */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Nome</p>
                  <p className="text-sm font-semibold text-stone-800">{schedaAperta.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Cognome</p>
                  <p className="text-sm font-semibold text-stone-800">{schedaAperta.cognome}</p>
                </div>
              </div>
              {schedaAperta.telefono && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Telefono</p>
                  <p className="text-sm text-stone-700 flex items-center gap-1.5"><Phone size={13} className="text-stone-400" />{schedaAperta.telefono}</p>
                </div>
              )}
              {schedaAperta.email && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Email</p>
                  <p className="text-sm text-stone-700 flex items-center gap-1.5"><Mail size={13} className="text-stone-400" />{schedaAperta.email}</p>
                </div>
              )}
              {schedaAperta.data_nascita && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Data di nascita</p>
                  <p className="text-sm text-stone-700 flex items-center gap-1.5"><Calendar size={13} className="text-stone-400" />{new Date(schedaAperta.data_nascita).toLocaleDateString('it-IT')}</p>
                </div>
              )}
              {schedaAperta.note && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Note / Allergie</p>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-lg px-3 py-2 leading-relaxed">{schedaAperta.note}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold mb-1">Inviata il</p>
                <p className="text-sm text-stone-500">{new Date(schedaAperta.created_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setEliminaGate(schedaAperta.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
              >
                <Trash2 size={15} />
                Elimina
              </button>
              <button
                onClick={() => confermaScheda(schedaAperta)}
                disabled={confermando === schedaAperta.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-bold transition-colors"
              >
                <Check size={15} />
                {confermando === schedaAperta.id ? 'Creazione...' : 'Conferma e crea scheda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {eliminaGate && (
        <PasswordGateModal
          titolo="Elimina scheda"
          descrizione="Inserisci la password per eliminare definitivamente questa scheda."
          chiavePassword="password_elimina_clienti"
          onSuccess={() => eliminaScheda(eliminaGate)}
          onClose={() => setEliminaGate(null)}
        />
      )}

      {eliminaClienteGate && (
        <PasswordGateModal
          titolo="Elimina cliente"
          descrizione="Inserisci la password per eliminare definitivamente questo cliente e tutti i suoi dati."
          chiavePassword="password_elimina_clienti"
          onSuccess={() => eseguiEliminaCliente(eliminaClienteGate)}
          onClose={() => setEliminaClienteGate(null)}
        />
      )}
    </div>
  );
}
