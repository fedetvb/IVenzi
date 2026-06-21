import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Search, Phone, Mail, ChevronRight, Trash2, Users, CreditCard, ClipboardList, Check, X, UserPlus, Clock, FileSpreadsheet, FileText, ChevronDown, MessageCircle, Calendar, ShieldOff, Ban, Star } from 'lucide-react';
import { supabase, type Cliente } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbDelete, getImpostazione } from '../lib/localDb';
import { apriWhatsApp, apriWhatsAppSenzaNumero } from '../lib/waUtils';
import ClienteModal from '../components/ClienteModal';
import PasswordGateModal from '../components/PasswordGateModal';
import { useAuth } from '../lib/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveFile } from '../lib/fileSaver';

interface Props {
  onSelectCliente: (id: string) => void;
  openSchedaId?: string | null;
  onSchedaOpened?: () => void;
}

interface SchedaDaConfermare {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  data_nascita: string | null;
  note: string;
  foto_url: string;
  stato: string;
  created_at: string;
  presentata_da_nome?: string | null;
  codice_carta_sconto?: string | null;
  codice_gift_pass?: string | null;
}

export default function Clienti({ onSelectCliente, openSchedaId, onSchedaOpened }: Props) {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [clientiCarteMap, setClientiCarteMap] = useState<Map<string, Set<string>>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'clienti' | 'da_confermare' | 'blacklist' | 'ambasciatori'>('clienti');
  const [schede, setSchede] = useState<SchedaDaConfermare[]>([]);
  const [schedeLoading, setSchedeLoading] = useState(false);
  const [schedaAperta, setSchedaAperta] = useState<SchedaDaConfermare | null>(null);
  const [confermando, setConfermando] = useState<string | null>(null);
  const [eliminaGate, setEliminaGate] = useState<string | null>(null);
  const [eliminaClienteGate, setEliminaClienteGate] = useState<string | null>(null);
  const [messaggioConferma, setMessaggioConferma] = useState<{ nome: string; testo: string; clienteId: string; telefono: string } | null>(null);

  // Ambasciatori
  interface AmbasciatoreReferral {
    clienteId: string;
    nome: string;
    cognome: string;
    presentate: Array<{ nome: string; cognome: string; clienteId: string | null }>;
  }
  const [ambasciatori, setAmbasciatori] = useState<AmbasciatoreReferral[]>([]);
  const [ambLoadng, setAmbLoading] = useState(false);
  const [ambExpanded, setAmbExpanded] = useState<Set<string>>(new Set());

  const loadAmbasciatori = useCallback(async () => {
    setAmbLoading(true);
    // Recupera tutte le gift_pass con cliente_id (donatore) e destinataria_cliente_id
    // e tutte le carte_sconto con regalata_da_cliente_id
    const [gpRes, csRes, schedaRes] = await Promise.all([
      supabase.from('gift_pass')
        .select('cliente_id, destinataria_cliente_id, destinataria_nome')
        .not('cliente_id', 'is', null)
        .is('deleted_at', null),
      supabase.from('carte_sconto')
        .select('regalata_da_cliente_id, cliente_id')
        .not('regalata_da_cliente_id', 'is', null),
      supabase.from('schede_clienti_da_confermare')
        .select('nome, cognome, codice_gift_pass, codice_carta_sconto, presentata_da_nome')
        .eq('stato', 'in_attesa'),
    ]);

    // Mappa: donatore_id -> lista presentate
    const map = new Map<string, Array<{ nome: string; cognome: string; clienteId: string | null }>>();

    // Da gift pass con destinataria cliente confermata
    for (const gp of (gpRes.data || []) as Array<{ cliente_id: string; destinataria_cliente_id: string | null; destinataria_nome: string }>) {
      if (!gp.cliente_id) continue;
      if (!map.has(gp.cliente_id)) map.set(gp.cliente_id, []);
      if (gp.destinataria_cliente_id) {
        const dest = clienti.find(c => c.id === gp.destinataria_cliente_id);
        if (dest) {
          const exists = map.get(gp.cliente_id)!.some(p => p.clienteId === dest.id);
          if (!exists) map.get(gp.cliente_id)!.push({ nome: dest.nome, cognome: dest.cognome, clienteId: dest.id });
        }
      }
    }

    // Da carte_sconto regalate con destinataria cliente confermata
    for (const cs of (csRes.data || []) as Array<{ regalata_da_cliente_id: string; cliente_id: string | null }>) {
      if (!cs.regalata_da_cliente_id) continue;
      if (!map.has(cs.regalata_da_cliente_id)) map.set(cs.regalata_da_cliente_id, []);
      if (cs.cliente_id) {
        const dest = clienti.find(c => c.id === cs.cliente_id);
        if (dest) {
          const exists = map.get(cs.regalata_da_cliente_id)!.some(p => p.clienteId === dest.id);
          if (!exists) map.get(cs.regalata_da_cliente_id)!.push({ nome: dest.nome, cognome: dest.cognome, clienteId: dest.id });
        }
      }
    }

    // Da schede in attesa: usa codice carta/gift pass e, come ultimo fallback, presentata_da_nome
    for (const s of (schedaRes.data || []) as Array<{ nome: string; cognome: string; codice_gift_pass: string | null; codice_carta_sconto: string | null; presentata_da_nome: string | null }>) {
      let linked = false;

      if (s.codice_gift_pass) {
        const { data: gp } = await supabase.from('gift_pass').select('cliente_id').eq('codice', s.codice_gift_pass).maybeSingle();
        const donatoreId = gp?.cliente_id ?? null;
        if (donatoreId) {
          const donatoreCl = clienti.find(c => c.id === donatoreId);
          const nomeD = donatoreCl ? `${donatoreCl.nome} ${donatoreCl.cognome}`.trim() : '';
          if (nomeD && !/^ignot/i.test(nomeD)) {
            if (!map.has(donatoreId)) map.set(donatoreId, []);
            const exists = map.get(donatoreId)!.some(p => p.nome === s.nome && p.cognome === s.cognome);
            if (!exists) map.get(donatoreId)!.push({ nome: s.nome, cognome: s.cognome, clienteId: null });
            linked = true;
          }
        }
      }

      if (!linked && s.codice_carta_sconto) {
        const { data: cs } = await supabase.from('carte_sconto').select('regalata_da_cliente_id').eq('codice', s.codice_carta_sconto).maybeSingle();
        if (cs?.regalata_da_cliente_id) {
          if (!map.has(cs.regalata_da_cliente_id)) map.set(cs.regalata_da_cliente_id, []);
          const exists = map.get(cs.regalata_da_cliente_id)!.some(p => p.nome === s.nome && p.cognome === s.cognome);
          if (!exists) map.get(cs.regalata_da_cliente_id)!.push({ nome: s.nome, cognome: s.cognome, clienteId: null });
          linked = true;
        }
      }

      // Fallback: presentata_da_nome → cerca il cliente in rubrica per nome
      if (!linked && s.presentata_da_nome) {
        const nomeCandidato = s.presentata_da_nome.trim();
        if (nomeCandidato && !/^ignot/i.test(nomeCandidato)) {
          const donByName = clienti.find(c =>
            `${c.nome} ${c.cognome}`.trim().toLowerCase() === nomeCandidato.toLowerCase()
          );
          if (donByName) {
            if (!map.has(donByName.id)) map.set(donByName.id, []);
            const exists = map.get(donByName.id)!.some(p => p.nome === s.nome && p.cognome === s.cognome);
            if (!exists) map.get(donByName.id)!.push({ nome: s.nome, cognome: s.cognome, clienteId: null });
          }
        }
      }
    }

    const result: AmbasciatoreReferral[] = [];
    for (const [clienteId, presentate] of map) {
      const c = clienti.find(cl => cl.id === clienteId);
      if (!c || presentate.length === 0) continue;
      result.push({ clienteId, nome: c.nome, cognome: c.cognome, presentate });
    }
    result.sort((a, b) => b.presentate.length - a.presentate.length);
    setAmbasciatori(result);
    setAmbLoading(false);
  }, [clienti]);

  const loadClienti = useCallback(async () => {
    setLoading(true);
    const [clientiRes, carteScRes, cartePreRes] = await Promise.all([
      dbSelect({ table: 'clienti', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'cognome'}, {col:'nome'}] }),
      dbSelect({ table: 'carte_sconto', columns: 'cliente_id, usa_e_getta', filters: [{col:'cliente_id', op:'not_null'}, {col:'deleted_at', op:'is_null'}, {col:'attiva', op:'eq', val:true}] }),
      dbSelect({ table: 'carte_premium', columns: 'cliente_id, saldo, attiva', filters: [{col:'deleted_at', op:'is_null'}] }),
    ]);
    setClienti((clientiRes.data || []) as Cliente[]);
    const carteMap = new Map<string, Set<string>>();
    for (const r of (carteScRes.data || []) as { cliente_id: string; usa_e_gatta: boolean }[]) {
      if (r.cliente_id) {
        if (!carteMap.has(r.cliente_id)) carteMap.set(r.cliente_id, new Set());
        carteMap.get(r.cliente_id)!.add(r.usa_e_gatta ? 'ueg' : 'sconto');
      }
    }
    for (const r of (cartePreRes.data || []) as { cliente_id: string; saldo: number; attiva: boolean }[]) {
      if (r.cliente_id) {
        if (!carteMap.has(r.cliente_id)) carteMap.set(r.cliente_id, new Set());
        carteMap.get(r.cliente_id)!.add(r.saldo > 0 && r.attiva ? 'premium' : 'premium_vuota');
      }
    }
    setClientiCarteMap(carteMap);
    setLoading(false);
  }, []);

  const loadSchede = useCallback(async () => {
    setSchedeLoading(true);
    // Fetch diretto a Supabase — questa tabella è popolata da form esterni (user_id = null)
    // e non deve essere letta dalla cache IndexedDB.
    const { data } = await supabase
      .from('schede_clienti_da_confermare')
      .select('*')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    setSchede((data || []) as SchedaDaConfermare[]);
    setSchedeLoading(false);
  }, []);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => { loadClienti(); }, [loadClienti]);
  useEffect(() => { if (tab === 'ambasciatori' && clienti.length > 0) loadAmbasciatori(); }, [tab, clienti, loadAmbasciatori]);

  // Carica schede in attesa all'avvio
  useEffect(() => { loadSchede(); }, [loadSchede]);

  // Apri automaticamente una scheda specifica quando richiesto dal banner
  useEffect(() => {
    if (!openSchedaId) return;
    setTab('da_confermare');
    // Se le schede sono già caricate, aprila subito; altrimenti aspetta il load
    const found = schede.find(s => s.id === openSchedaId);
    if (found) {
      setSchedaAperta(found);
      onSchedaOpened?.();
    } else {
      // Ricarica e poi apri — solo se ancora in_attesa
      supabase
        .from('schede_clienti_da_confermare')
        .select('*')
        .eq('id', openSchedaId)
        .maybeSingle()
        .then(({ data }) => {
          if (data && (data as SchedaDaConfermare).stato === 'in_attesa') {
            setSchede(prev => {
              if (prev.find(s => s.id === (data as SchedaDaConfermare).id)) return prev;
              return [data as SchedaDaConfermare, ...prev];
            });
            setSchedaAperta(data as SchedaDaConfermare);
          }
          onSchedaOpened?.();
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSchedaId]);

  // Realtime: aggiorna il conteggio quando arriva una nuova scheda
  useEffect(() => {
    const ch = supabase
      .channel('schede_da_confermare_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schede_clienti_da_confermare' }, () => {
        loadSchede();
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [loadSchede]);

  async function deleteCliente(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEliminaClienteGate(id);
  }

  async function eseguiEliminaCliente(id: string) {
    await dbUpdate({ table: 'clienti', id, data: { deleted_at: new Date().toISOString() } });
    setEliminaClienteGate(null);
    loadClienti();
  }

  function genderBenvenuto(nome: string): string {
    const n = nome.trim().toLowerCase();
    const maschiliEccezioni = ['luca', 'andrea', 'nicola', 'mattia', 'enea', 'elia', 'tobia', 'battista'];
    if (maschiliEccezioni.includes(n)) return 'Benvenuto';
    if (n.endsWith('a') || n.endsWith('e')) return 'Benvenuta';
    return 'Benvenuto';
  }

  function buildMessaggioConferma(nome: string): string {
    const benvenuto = genderBenvenuto(nome);
    const cornice = '🌟🌸🌈🦋🌸🦋🌈🌸🌟';
    return `${cornice}\n${benvenuto} ${nome}!\n\nGrazie mille per aver scelto il nostro salone. Siamo felicissimi di averti con noi!\n\nI tuoi dati sono trattati con la massima riservatezza e non verranno mai condivisi con terzi. La tua privacy è al sicuro.\n\nLa scheda che hai compilato ci permetterà di conoscerti al meglio e di offrirti un servizio personalizzato, sempre in linea con le tue esigenze e i tuoi desideri.\n\nNon vediamo l'ora di prenderci cura di te!\n${cornice}`;
  }

  async function confermaScheda(scheda: SchedaDaConfermare) {
    setConfermando(scheda.id);
    // Guard: rilegge lo stato aggiornato da Supabase prima di procedere
    const { data: fresh } = await supabase
      .from('schede_clienti_da_confermare')
      .select('stato')
      .eq('id', scheda.id)
      .maybeSingle();
    if (!fresh || (fresh as { stato: string }).stato !== 'in_attesa') {
      // Già confermata o eliminata da un altro dispositivo
      setConfermando(null);
      setSchedaAperta(null);
      loadSchede();
      return;
    }
    const clienteRes = await dbInsert({
      table: 'clienti',
      data: {
        nome: scheda.nome,
        cognome: scheda.cognome,
        telefono: scheda.telefono || '',
        email: scheda.email || '',
        data_nascita: scheda.data_nascita || null,
        note: scheda.note || '',
        foto_url: scheda.foto_url || '',
        user_id: user?.id,
      }
    });

    if (!clienteRes.error && clienteRes.data?.id) {
      // Hard delete with retry on auth failure
      let { error: delErr } = await supabase
        .from('schede_clienti_da_confermare')
        .delete()
        .eq('id', scheda.id);
      if (delErr) {
        // Token potrebbe essere scaduto — forza il refresh e riprova una volta
        await supabase.auth.refreshSession();
        const retry = await supabase
          .from('schede_clienti_da_confermare')
          .delete()
          .eq('id', scheda.id);
        delErr = retry.error;
        if (delErr) console.error('[confermaScheda] delete failed:', delErr.message);
      }

      // Se la scheda aveva un codice carta sconto, assegna la carta al nuovo cliente
      if (scheda.codice_carta_sconto) {
        const { data: carta } = await supabase
          .from('carte_sconto')
          .select('id')
          .eq('user_id', user?.id)
          .eq('codice', scheda.codice_carta_sconto.toUpperCase())
          .eq('regalata', true)
          .eq('attiva', true)
          .maybeSingle();
        if (carta) {
          await supabase.from('carte_sconto').update({
            cliente_id: clienteRes.data.id,
            regalata: false,
          }).eq('id', carta.id);
        }
      }

      // Se la scheda aveva un codice gift pass, collega la gift pass al nuovo cliente
      if (scheda.codice_gift_pass) {
        const { data: gp } = await supabase
          .from('gift_pass')
          .select('id')
          .eq('user_id', user?.id)
          .eq('codice', scheda.codice_gift_pass.toUpperCase())
          .eq('attiva', true)
          .eq('utilizzata', false)
          .maybeSingle();
        if (gp) {
          await supabase.from('gift_pass').update({
            destinataria_cliente_id: clienteRes.data.id,
          }).eq('id', gp.id);
        }
      }

      // Aggancia i messaggi inviati da questa cliente (per telefono, senza cliente_id) al nuovo cliente
      await supabase
        .from('messaggi_clienti')
        .update({ cliente_id: clienteRes.data.id })
        .eq('user_id', user?.id)
        .eq('telefono', scheda.telefono || '')
        .is('cliente_id', null);

      setSchedaAperta(null);
      loadClienti();
      const waDisabilitato = await getImpostazione('whatsapp_avviso_disabilitato');
      if (waDisabilitato !== 'true') {
        setMessaggioConferma({ nome: scheda.nome, testo: buildMessaggioConferma(scheda.nome), clienteId: clienteRes.data.id, telefono: scheda.telefono || '' });
      }
    }
    setConfermando(null);
    loadSchede();
  }

  async function eliminaScheda(id: string) {
    await dbDelete({ table: 'schede_clienti_da_confermare', filters: [{col:'id', op:'eq', val:id}] });
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

  function formatDataIT(iso: string | null) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function esportaExcel() {
    setExporting(true);
    const header = ['Cognome', 'Nome', 'Telefono', 'Email', 'Data di nascita', 'Eta', 'Note'];
    const rows = clienti.map(c => [
      c.cognome, c.nome, c.telefono ?? '', c.email ?? '',
      formatDataIT(c.data_nascita ?? null), calcEta(c.data_nascita ?? null), (c.note ?? '').replace(/\n/g, ' '),
    ]);
    const csvContent = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    await saveFile('clienti', `clienti-${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.csv`, '\uFEFF' + csvContent);
    setExporting(false);
    setExportOpen(false);
  }

  async function scaricaCsv(filename: string, header: string[], rows: string[][]) {
    const csvContent = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    await saveFile('clienti', filename, '\uFEFF' + csvContent);
  }

  async function esportaSchedeColore() {
    setExporting(true);
    setExportOpen(false);
    const mappaClienti = Object.fromEntries(clienti.map(c => [c.id, c]));
    const res = await dbSelect({ table: 'schede_colore', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'data_trattamento', asc:false}] });
    const rows = (res.data || []).map(s => {
      const c = mappaClienti[s.cliente_id];
      return [
        c ? `${c.cognome} ${c.nome}` : '',
        c?.telefono ?? '',
        formatDataIT(s.data_trattamento),
        s.tecnica ?? '',
        s.colore_base ?? '',
        s.colore_target ?? '',
        s.formula_colore ?? '',
        s.ossidante ?? '',
        s.tempo_posa ? String(s.tempo_posa) : '',
        (s.note ?? '').replace(/\n/g, ' '),
      ];
    });
    scaricaCsv(
      `schede-colore-${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.csv`,
      ['Cliente', 'Telefono', 'Data trattamento', 'Tecnica', 'Colore base', 'Colore target', 'Formula colore', 'Ossidante', 'Tempo posa (min)', 'Note'],
      rows
    );
    setExporting(false);
  }

  async function esportaCartePremium() {
    setExporting(true);
    setExportOpen(false);
    const { data } = await supabase
      .from('carte_premium')
      .select('*, clienti(nome, cognome, telefono)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    const rows = (data || []).map((cp: { codice: string; saldo: number; attiva: boolean; note: string; created_at: string; clienti?: { cognome?: string; nome?: string; telefono?: string } | null }) => [
      cp.clienti ? `${cp.clienti.cognome ?? ''} ${cp.clienti.nome ?? ''}`.trim() : '',
      cp.clienti?.telefono ?? '',
      cp.codice ?? '',
      cp.attiva ? 'Attiva' : 'Disattiva',
      `€${Number(cp.saldo ?? 0).toFixed(2).replace('.', ',')}`,
      (cp.note ?? '').replace(/\n/g, ' '),
      formatDataIT(cp.created_at?.slice(0, 10)),
    ]);
    scaricaCsv(
      `carte-premium-${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.csv`,
      ['Cliente', 'Telefono', 'Codice carta', 'Stato', 'Saldo', 'Note', 'Data creazione'],
      rows
    );
    setExporting(false);
  }

  async function esportaCarteSconto() {
    setExporting(true);
    setExportOpen(false);
    const { data } = await supabase
      .from('carte_sconto')
      .select('*, clienti(nome, cognome, telefono)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    const rows = (data || []).map((cs: { codice: string; descrizione: string; tipo_sconto: string; valore_sconto: number; attiva: boolean; usa_e_gatta: boolean; nominativa: boolean; created_at: string; clienti?: { cognome?: string; nome?: string; telefono?: string } | null }) => [
      cs.clienti ? `${cs.clienti.cognome ?? ''} ${cs.clienti.nome ?? ''}`.trim() : '(Generica)',
      cs.clienti?.telefono ?? '',
      cs.codice ?? '',
      cs.descrizione ?? '',
      cs.tipo_sconto === 'percentuale' ? `${cs.valore_sconto}%` : `€${Number(cs.valore_sconto).toFixed(2).replace('.', ',')}`,
      cs.attiva ? 'Attiva' : 'Disattiva',
      cs.nominativa ? 'Si' : 'No',
      cs.usa_e_gatta ? 'Si' : 'No',
      formatDataIT(cs.created_at?.slice(0, 10)),
    ]);
    scaricaCsv(
      `carte-sconto-${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.csv`,
      ['Cliente', 'Telefono', 'Codice', 'Descrizione', 'Sconto', 'Stato', 'Nominativa', 'Usa e gatta', 'Data creazione'],
      rows
    );
    setExporting(false);
  }

  async function esportaPDF() {
    setExporting(true);
    setExportOpen(false);

    const [schedeColoreRes, cartePremiumRes, carteScontoRes] = await Promise.all([
      dbSelect({ table: 'schede_colore', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'data_trattamento', asc:false}] }),
      dbSelect({ table: 'carte_premium', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'created_at', asc:false}] }),
      dbSelect({ table: 'carte_sconto', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'created_at', asc:false}] }),
    ]);

    const mappaClienti = Object.fromEntries(clienti.map(c => [c.id, c]));

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const dateStr = new Date().toLocaleDateString('it-IT');
    const W = 297;

    // ── Pagina 1: Anagrafiche ──────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Elenco Clienti', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Esportato il ${dateStr} — ${clienti.length} clienti`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Cognome', 'Nome', 'Telefono', 'Email', 'Data di nascita', 'Eta', 'Note']],
      body: clienti.map(c => [
        c.cognome, c.nome, c.telefono ?? '', c.email ?? '',
        formatDataIT(c.data_nascita ?? null),
        calcEta(c.data_nascita ?? null),
        (c.note ?? '').slice(0, 60),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 6: { cellWidth: 50 } },
    });

    // ── Pagina 2: Schede colore ────────────────────────────────────────────────
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Schede Colore', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${(schedeColoreRes.data || []).length} schede — esportato il ${dateStr}`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Cliente', 'Telefono', 'Data', 'Tecnica', 'Colore base', 'Colore target', 'Formula', 'Ossidante', 'Posa', 'Note']],
      body: (schedeColoreRes.data || []).map(s => {
        const c = mappaClienti[s.cliente_id];
        return [
          c ? `${c.cognome} ${c.nome}` : '',
          c?.telefono ?? '',
          formatDataIT(s.data_trattamento),
          s.tecnica ?? '',
          s.colore_base ?? '',
          s.colore_target ?? '',
          (s.formula_colore ?? '').slice(0, 40),
          s.ossidante ?? '',
          s.tempo_posa ? `${s.tempo_posa}'` : '',
          (s.note ?? '').slice(0, 50),
        ];
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 6: { cellWidth: 40 }, 9: { cellWidth: 40 } },
    });

    // ── Pagina 3: Carte premium ────────────────────────────────────────────────
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Carte Premium', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${(cartePremiumRes.data || []).length} carte — esportato il ${dateStr}`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Cliente', 'Telefono', 'Codice carta', 'Stato', 'Saldo', 'Note', 'Data creazione']],
      body: (cartePremiumRes.data || []).map(cp => {
        const c = mappaClienti[cp.cliente_id];
        return [
          c ? `${c.cognome} ${c.nome}` : '',
          c?.telefono ?? '',
          cp.codice ?? '',
          cp.attiva ? 'Attiva' : 'Disattiva',
          `€${Number(cp.saldo ?? 0).toFixed(2).replace('.', ',')}`,
          (cp.note ?? '').slice(0, 50),
          formatDataIT(cp.created_at?.slice(0, 10)),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 4: { halign: 'right' } },
    });

    // ── Pagina 4: Carte sconto ─────────────────────────────────────────────────
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Carte Sconto', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${(carteScontoRes.data || []).length} carte — esportato il ${dateStr}`, 14, 22);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Cliente', 'Telefono', 'Codice', 'Descrizione', 'Sconto', 'Stato', 'Nominativa', 'Usa e gatta', 'Data creazione']],
      body: (carteScontoRes.data || []).map(cs => {
        const c = cs.cliente_id ? mappaClienti[cs.cliente_id] : null;
        return [
          c ? `${c.cognome} ${c.nome}` : '(Generica)',
          c?.telefono ?? '',
          cs.codice ?? '',
          (cs.descrizione ?? '').slice(0, 40),
          cs.tipo_sconto === 'percentuale' ? `${cs.valore_sconto}%` : `€${Number(cs.valore_sconto).toFixed(2).replace('.', ',')}`,
          cs.attiva ? 'Attiva' : 'Disattiva',
          cs.nominativa ? 'Si' : 'No',
          cs.usa_e_gatta ? 'Si' : 'No',
          formatDataIT(cs.created_at?.slice(0, 10)),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
    });

    // Numerazione pagine
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(`Pagina ${i} di ${totalPages}`, W - 14, 205, { align: 'right' });
    }

    const filename = `report-completo-${new Date().toLocaleDateString('it-IT').replace(/\//g, '-')}.pdf`;
    await saveFile('clienti', filename, doc.output('blob'));
    setExporting(false);
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

  const sortedFiltered = query.trim()
    ? [...filtered].sort((a, b) => {
        const q = query.toLowerCase();
        const aS = a.nome.toLowerCase().startsWith(q) || a.cognome.toLowerCase().startsWith(q);
        const bS = b.nome.toLowerCase().startsWith(q) || b.cognome.toLowerCase().startsWith(q);
        return aS === bS ? 0 : aS ? -1 : 1;
      })
    : filtered;

  const grouped = sortedFiltered.reduce<Record<string, Cliente[]>>((acc, c) => {
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
        <button
          onClick={() => setTab('blacklist')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'blacklist' ? 'bg-white text-red-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <Ban size={15} />
          Lista nera
          {clienti.filter(c => c.in_blacklist).length > 0 && (
            <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">{clienti.filter(c => c.in_blacklist).length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('ambasciatori')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'ambasciatori' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <Star size={15} />
          Ambasciatori
          {ambasciatori.length > 0 && (
            <span className="text-xs bg-amber-500 text-white rounded-full px-2 py-0.5">{ambasciatori.length}</span>
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
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5 min-w-[210px]">
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Clienti</p>
                    <button
                      onClick={esportaExcel}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600 flex-shrink-0" />
                      <span>Anagrafiche Excel</span>
                    </button>
                    <button
                      onClick={esportaPDF}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileText size={14} className="text-red-500 flex-shrink-0" />
                      <span>Report completo PDF</span>
                    </button>

                    <div className="my-1 border-t border-stone-100" />
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Schede & Carte</p>
                    <button
                      onClick={esportaSchedeColore}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-violet-500 flex-shrink-0" />
                      <span>Schede colore Excel</span>
                    </button>
                    <button
                      onClick={esportaCartePremium}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-amber-500 flex-shrink-0" />
                      <span>Carte premium Excel</span>
                    </button>
                    <button
                      onClick={esportaCarteSconto}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-blue-500 flex-shrink-0" />
                      <span>Carte sconto Excel</span>
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
                        className={`bg-white rounded-xl border px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-sm transition-all group ${c.in_blacklist ? 'border-red-200 bg-red-50/30 hover:border-red-400' : 'border-stone-200 hover:border-amber-300'}`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${c.in_blacklist ? 'bg-red-100' : 'bg-amber-100'}`}>
                          {c.in_blacklist ? (
                            <ShieldOff size={16} className="text-red-500" />
                          ) : c.foto_url ? (
                            <img src={c.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-amber-700">
                              {c.nome[0]?.toUpperCase()}{c.cognome[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-semibold transition-colors ${c.in_blacklist ? 'text-red-700 group-hover:text-red-800' : 'text-stone-800 group-hover:text-amber-700'}`}>
                              {c.cognome} {c.nome}
                            </p>
                            {c.in_blacklist && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase tracking-wide">
                                <ShieldOff size={9} /> Blacklist
                              </span>
                            )}
                            {clientiCarteMap.has(c.id) && (() => {
                              const tipi = clientiCarteMap.get(c.id)!;
                              if (tipi.has('premium')) return <CreditCard size={13} className="text-amber-500 flex-shrink-0" title="Carta premium attiva" />;
                              if (tipi.has('premium_vuota')) return <CreditCard size={13} className="text-red-400 flex-shrink-0" title="Carta premium esaurita" />;
                              if (tipi.has('sconto')) return <CreditCard size={13} className="text-teal-500 flex-shrink-0" title="Carta sconto" />;
                              if (tipi.has('ueg')) return <CreditCard size={13} className="text-stone-600 flex-shrink-0" title="Carta usa e gatta" />;
                              return null;
                            })()}
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
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {s.foto_url ? (
                      <img src={s.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserPlus size={16} className="text-amber-600" />
                    )}
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
                    {s.presentata_da_nome && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">
                        Presentata da noi tramite {s.presentata_da_nome}
                      </p>
                    )}
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

      {tab === 'blacklist' && (() => {
        const blacklisted = clienti.filter(c => c.in_blacklist);
        return (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-stone-500">
                {blacklisted.length === 0
                  ? 'Nessun cliente in lista nera.'
                  : `${blacklisted.length} ${blacklisted.length === 1 ? 'cliente' : 'clienti'} in lista nera. Apri la scheda per rimuoverli.`}
              </p>
            </div>
            {blacklisted.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-16 text-center">
                <Ban size={32} className="text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 font-medium">Lista nera vuota</p>
                <p className="text-stone-400 text-sm mt-1">Nessun cliente e' stato inserito in lista nera</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blacklisted.map(c => (
                  <div
                    key={c.id}
                    onClick={() => onSelectCliente(c.id)}
                    className="bg-red-50 rounded-xl border border-red-200 px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-red-400 hover:shadow-sm transition-all group"
                  >
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldOff size={16} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-red-800 group-hover:text-red-900 transition-colors">
                        {c.cognome} {c.nome}
                      </p>
                      {c.motivo_blacklist && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{c.motivo_blacklist}</p>
                      )}
                      <div className="flex items-center gap-4 mt-0.5">
                        {c.telefono && (
                          <span className="flex items-center gap-1 text-xs text-stone-400">
                            <Phone size={10} /> {c.telefono}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-red-300 group-hover:text-red-500 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {tab === 'ambasciatori' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-stone-500">
              Clienti che hanno presentato nuove clienti al salone tramite donazione di carte.
            </p>
            <button
              onClick={loadAmbasciatori}
              className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
            >
              Aggiorna
            </button>
          </div>

          {ambLoadng ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ambasciatori.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-16 text-center">
              <Star size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessuna ambasciatrice ancora</p>
              <p className="text-stone-400 text-sm mt-1">Quando una cliente dona una carta e la ricevente si registra, appare qui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ambasciatori.map(amb => {
                const isExpanded = ambExpanded.has(amb.clienteId);
                return (
                  <div key={amb.clienteId} className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                    <div className="px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Star size={16} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onSelectCliente(amb.clienteId)}
                          className="font-semibold text-stone-800 hover:text-amber-700 transition-colors text-left"
                        >
                          {amb.cognome} {amb.nome}
                        </button>
                      </div>
                      <button
                        onClick={() => setAmbExpanded(prev => {
                          const next = new Set(prev);
                          if (next.has(amb.clienteId)) next.delete(amb.clienteId);
                          else next.add(amb.clienteId);
                          return next;
                        })}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex-shrink-0"
                      >
                        <span className="text-sm font-bold text-amber-700">
                          {amb.presentate.length} {amb.presentate.length === 1 ? 'cliente' : 'clienti'}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-amber-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-amber-100 px-5 py-3 space-y-2 bg-amber-50/40">
                        {amb.presentate.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-amber-700">{i + 1}</span>
                            </div>
                            {p.clienteId ? (
                              <button
                                onClick={() => onSelectCliente(p.clienteId!)}
                                className="text-sm text-stone-700 hover:text-amber-700 font-medium transition-colors text-left"
                              >
                                {p.cognome} {p.nome}
                              </button>
                            ) : (
                              <span className="text-sm text-stone-500 italic">
                                {p.cognome} {p.nome} <span className="text-[10px] text-amber-500 font-semibold ml-1">(in attesa di conferma)</span>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
              {schedaAperta.foto_url && (
                <div className="flex justify-center pb-2">
                  <img
                    src={schedaAperta.foto_url}
                    alt={`${schedaAperta.nome} ${schedaAperta.cognome}`}
                    className="w-24 h-24 rounded-full object-cover border-4 border-amber-100 shadow"
                  />
                </div>
              )}
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
              {schedaAperta.presentata_da_nome && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-emerald-600 uppercase tracking-wide font-bold mb-1">Referente</p>
                  <p className="text-sm text-emerald-800 font-semibold">
                    Presentata in salone tramite {schedaAperta.presentata_da_nome}
                  </p>
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

      {messaggioConferma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-800">Messaggio di benvenuto</h2>
                <p className="text-xs text-stone-400 mt-0.5">Invia su WhatsApp a {messaggioConferma.nome}</p>
              </div>
              <button
                onClick={() => { const id = messaggioConferma.clienteId; setMessaggioConferma(null); onSelectCliente(id); }}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="bg-stone-50 rounded-xl px-4 py-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap border border-stone-100">
                {messaggioConferma.testo}
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button
                onClick={() => {
                  if (messaggioConferma.telefono?.trim()) {
                    apriWhatsApp(messaggioConferma.telefono, messaggioConferma.testo);
                  } else {
                    apriWhatsAppSenzaNumero(messaggioConferma.testo);
                  }
                  setMessaggioConferma(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-600 text-white transition-colors"
              >
                <MessageCircle size={16} />
                Invia su WhatsApp
              </button>
              <button
                onClick={() => { const id = messaggioConferma.clienteId; setMessaggioConferma(null); onSelectCliente(id); }}
                className="px-4 py-3 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Vai alla scheda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
