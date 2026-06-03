import { supabase, localDateStr } from './supabase';

// ─── Tool definitions for Gemini function calling ──────────────────────────

export const TOOL_DECLARATIONS = [
  {
    name: 'get_appuntamenti_oggi',
    description: 'Restituisce gli appuntamenti di oggi (o di una data specifica). Utile per sapere chi ha appuntamento, a che ora, con quale parrucchiere.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: {
          type: 'STRING',
          description: 'Data in formato YYYY-MM-DD. Se omessa usa oggi.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_appuntamenti_settimana',
    description: 'Restituisce tutti gli appuntamenti della settimana corrente o di una settimana specifica.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data_inizio: {
          type: 'STRING',
          description: 'Data inizio settimana YYYY-MM-DD. Se omessa usa lunedi corrente.',
        },
      },
      required: [],
    },
  },
  {
    name: 'crea_appuntamento',
    description: 'Crea un nuovo appuntamento. Richiede nome cliente (cercato automaticamente), data, ora e durata.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome_cliente: {
          type: 'STRING',
          description: 'Nome o cognome del cliente (cerca automaticamente)',
        },
        data: {
          type: 'STRING',
          description: 'Data appuntamento YYYY-MM-DD',
        },
        ora: {
          type: 'STRING',
          description: 'Ora appuntamento HH:MM (es. 10:30)',
        },
        durata_minuti: {
          type: 'NUMBER',
          description: 'Durata in minuti (default 60)',
        },
        nome_parrucchiere: {
          type: 'STRING',
          description: 'Nome parrucchiere (opzionale)',
        },
        note: {
          type: 'STRING',
          description: 'Note appuntamento (opzionale)',
        },
      },
      required: ['nome_cliente', 'data', 'ora'],
    },
  },
  {
    name: 'get_statistiche_incassi',
    description: 'Restituisce le statistiche di incasso: totale, media, numero fiches per un periodo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: {
          type: 'STRING',
          description: 'oggi | ieri | settimana | mese | anno. Default: mese',
          enum: ['oggi', 'ieri', 'settimana', 'mese', 'anno'],
        },
      },
      required: [],
    },
  },
  {
    name: 'get_statistiche_servizi',
    description: 'Restituisce i servizi piu eseguiti e la loro quantita in un periodo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: {
          type: 'STRING',
          description: 'oggi | ieri | settimana | mese | anno. Default: mese',
          enum: ['oggi', 'ieri', 'settimana', 'mese', 'anno'],
        },
      },
      required: [],
    },
  },
  {
    name: 'get_statistiche_parrucchieri',
    description: 'Restituisce le statistiche per parrucchiere: numero appuntamenti, incasso totale, media fiche.',
    parameters: {
      type: 'OBJECT',
      properties: {
        periodo: {
          type: 'STRING',
          description: 'settimana | mese | anno. Default: mese',
          enum: ['settimana', 'mese', 'anno'],
        },
      },
      required: [],
    },
  },
  {
    name: 'cerca_cliente',
    description: 'Cerca un cliente per nome, cognome o telefono e restituisce le sue informazioni e storico visite.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Nome, cognome o numero di telefono del cliente',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_clienti_assenti',
    description: 'Trova i clienti che non vengono da piu di N giorni.',
    parameters: {
      type: 'OBJECT',
      properties: {
        giorni: {
          type: 'NUMBER',
          description: 'Numero minimo di giorni di assenza (default 60)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_slot_liberi',
    description: 'Trova gli slot orari liberi per una data specifica, considerando gli appuntamenti esistenti.',
    parameters: {
      type: 'OBJECT',
      properties: {
        data: {
          type: 'STRING',
          description: 'Data in formato YYYY-MM-DD',
        },
        durata_minuti: {
          type: 'NUMBER',
          description: 'Durata dello slot richiesto in minuti (default 60)',
        },
      },
      required: ['data'],
    },
  },
];

// ─── Tool execution functions ───────────────────────────────────────────────

function getDateRange(periodo: string): { from: string; to: string } {
  const now = new Date();
  const today = localDateStr(now);

  if (periodo === 'oggi') {
    return { from: today, to: today };
  }
  if (periodo === 'ieri') {
    const ieri = new Date(now);
    ieri.setDate(now.getDate() - 1);
    const d = localDateStr(ieri);
    return { from: d, to: d };
  }
  if (periodo === 'settimana') {
    const day = now.getDay(); // 0=domenica
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: localDateStr(mon), to: localDateStr(sun) };
  }
  if (periodo === 'anno') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  // default: mese
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` };
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'get_appuntamenti_oggi':
        return await getAppuntamentiOggi(args);
      case 'get_appuntamenti_settimana':
        return await getAppuntamentiSettimana(args);
      case 'crea_appuntamento':
        return await creaAppuntamento(args);
      case 'get_statistiche_incassi':
        return await getStatisticheIncassi(args);
      case 'get_statistiche_servizi':
        return await getStatisticheServizi(args);
      case 'get_statistiche_parrucchieri':
        return await getStatisticheParrucchieri(args);
      case 'cerca_cliente':
        return await cercaCliente(args);
      case 'get_clienti_assenti':
        return await getClientiAssenti(args);
      case 'get_slot_liberi':
        return await getSlotLiberi(args);
      default:
        return JSON.stringify({ errore: `Tool sconosciuto: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ errore: String(err) });
  }
}

async function getAppuntamentiOggi(args: Record<string, unknown>): Promise<string> {
  const data = (args.data as string) || localDateStr();
  const from = `${data}T00:00:00`;
  const to = `${data}T23:59:59`;

  const { data: apps, error } = await supabase
    .from('appuntamenti')
    .select(`id, data_ora, durata_minuti, stato, note, prezzo_totale,
      clienti(nome, cognome, telefono),
      parrucchieri(nome)`)
    .gte('data_ora', new Date(from).toISOString())
    .lte('data_ora', new Date(to).toISOString())
    .is('deleted_at', null)
    .order('data_ora');

  if (error) return JSON.stringify({ errore: error.message });

  if (!apps || apps.length === 0)
    return JSON.stringify({ data, appuntamenti: [], messaggio: 'Nessun appuntamento trovato per questa data.' });

  const lista = apps.map((a: Record<string, unknown>) => {
    const ora = new Date(a.data_ora as string).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const cliente = a.clienti as Record<string, string> | null;
    const parrucchiere = a.parrucchieri as Record<string, string> | null;
    return {
      ora,
      cliente: cliente ? `${cliente.nome} ${cliente.cognome}` : 'Cliente non specificato',
      telefono: cliente?.telefono || null,
      parrucchiere: parrucchiere?.nome || null,
      durata_minuti: a.durata_minuti,
      stato: a.stato,
      prezzo: a.prezzo_totale,
      note: a.note || null,
    };
  });

  return JSON.stringify({ data, totale: lista.length, appuntamenti: lista });
}

async function getAppuntamentiSettimana(args: Record<string, unknown>): Promise<string> {
  let dataInizio = args.data_inizio as string | undefined;
  if (!dataInizio) {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    dataInizio = localDateStr(mon);
  }
  const start = new Date(`${dataInizio}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59);

  const { data: apps, error } = await supabase
    .from('appuntamenti')
    .select(`data_ora, durata_minuti, stato,
      clienti(nome, cognome),
      parrucchieri(nome)`)
    .gte('data_ora', start.toISOString())
    .lte('data_ora', end.toISOString())
    .is('deleted_at', null)
    .order('data_ora');

  if (error) return JSON.stringify({ errore: error.message });

  const byDay: Record<string, unknown[]> = {};
  (apps || []).forEach((a: Record<string, unknown>) => {
    const d = localDateStr(new Date(a.data_ora as string));
    if (!byDay[d]) byDay[d] = [];
    const ora = new Date(a.data_ora as string).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const cliente = a.clienti as Record<string, string> | null;
    const parrucchiere = a.parrucchieri as Record<string, string> | null;
    byDay[d].push({
      ora,
      cliente: cliente ? `${cliente.nome} ${cliente.cognome}` : 'N/D',
      parrucchiere: parrucchiere?.nome || null,
      stato: a.stato,
    });
  });

  return JSON.stringify({ settimana_dal: dataInizio, totale: apps?.length || 0, per_giorno: byDay });
}

async function creaAppuntamento(args: Record<string, unknown>): Promise<string> {
  const { nome_cliente, data, ora, durata_minuti = 60, nome_parrucchiere, note } = args as {
    nome_cliente: string; data: string; ora: string;
    durata_minuti?: number; nome_parrucchiere?: string; note?: string;
  };

  // Cerca cliente
  const termini = nome_cliente.trim().split(' ');
  let query = supabase.from('clienti').select('id, nome, cognome').is('deleted_at', null);
  if (termini.length >= 2) {
    query = query.or(`nome.ilike.%${termini[0]}%,cognome.ilike.%${termini[termini.length - 1]}%`);
  } else {
    query = query.or(`nome.ilike.%${nome_cliente}%,cognome.ilike.%${nome_cliente}%`);
  }
  const { data: clienti, error: cErr } = await query.limit(5);
  if (cErr) return JSON.stringify({ errore: cErr.message });
  if (!clienti || clienti.length === 0)
    return JSON.stringify({ errore: `Cliente "${nome_cliente}" non trovato. Verifica il nome o crealo prima dall'app.` });
  if (clienti.length > 1)
    return JSON.stringify({
      errore: `Trovati piu clienti con nome simile: ${clienti.map((c: Record<string, string>) => `${c.nome} ${c.cognome}`).join(', ')}. Specifica meglio.`,
    });

  const cliente = clienti[0] as { id: string; nome: string; cognome: string };

  // Cerca parrucchiere se specificato
  let parrucchiereId: string | null = null;
  if (nome_parrucchiere) {
    const { data: parr } = await supabase
      .from('parrucchieri')
      .select('id, nome')
      .ilike('nome', `%${nome_parrucchiere}%`)
      .eq('attivo', true)
      .limit(1)
      .maybeSingle();
    if (parr) parrucchiereId = (parr as { id: string }).id;
  }

  // Costruisci data_ora
  const dataOra = new Date(`${data}T${ora}:00`);
  if (isNaN(dataOra.getTime()))
    return JSON.stringify({ errore: `Data o ora non valida: ${data} ${ora}` });

  const { data: newApp, error: insErr } = await supabase
    .from('appuntamenti')
    .insert({
      cliente_id: cliente.id,
      parrucchiere_id: parrucchiereId,
      data_ora: dataOra.toISOString(),
      durata_minuti,
      stato: 'confermato',
      note: note || '',
      prezzo_totale: 0,
    })
    .select('id')
    .single();

  if (insErr) return JSON.stringify({ errore: insErr.message });

  return JSON.stringify({
    successo: true,
    messaggio: `Appuntamento creato per ${cliente.nome} ${cliente.cognome} il ${data} alle ${ora} (${durata_minuti} min).`,
    appuntamento_id: (newApp as { id: string }).id,
  });
}

async function getStatisticheIncassi(args: Record<string, unknown>): Promise<string> {
  const periodo = (args.periodo as string) || 'mese';
  const { from, to } = getDateRange(periodo);

  const { data: fiches, error } = await supabase
    .from('fiches')
    .select('importo_convalidato, convalidata, created_at')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`);

  if (error) return JSON.stringify({ errore: error.message });

  const convalidate = (fiches || []).filter((f: Record<string, unknown>) => f.convalidata);
  const totale = convalidate.reduce((s, f: Record<string, unknown>) => s + (Number(f.importo_convalidato) || 0), 0);
  const media = convalidate.length > 0 ? totale / convalidate.length : 0;

  return JSON.stringify({
    periodo,
    dal: from,
    al: to,
    totale_incassato: totale.toFixed(2),
    numero_fiches_convalidate: convalidate.length,
    numero_fiches_totali: fiches?.length || 0,
    media_fiche: media.toFixed(2),
  });
}

async function getStatisticheServizi(args: Record<string, unknown>): Promise<string> {
  const periodo = (args.periodo as string) || 'mese';
  const { from, to } = getDateRange(periodo);

  const { data: voci, error } = await supabase
    .from('fiche_voci')
    .select('nome_voce, prezzo, tipo, created_at')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`);

  if (error) return JSON.stringify({ errore: error.message });

  const conteggio: Record<string, { quantita: number; totale: number }> = {};
  (voci || []).forEach((v: Record<string, unknown>) => {
    const nome = String(v.nome_voce);
    if (!conteggio[nome]) conteggio[nome] = { quantita: 0, totale: 0 };
    conteggio[nome].quantita += 1;
    conteggio[nome].totale += Number(v.prezzo) || 0;
  });

  const classifica = Object.entries(conteggio)
    .map(([nome, { quantita, totale }]) => ({ nome, quantita, totale_euro: totale.toFixed(2) }))
    .sort((a, b) => b.quantita - a.quantita)
    .slice(0, 15);

  return JSON.stringify({ periodo, dal: from, al: to, servizi_piu_eseguiti: classifica });
}

async function getStatisticheParrucchieri(args: Record<string, unknown>): Promise<string> {
  const periodo = (args.periodo as string) || 'mese';
  const { from, to } = getDateRange(periodo);

  const { data: apps, error } = await supabase
    .from('appuntamenti')
    .select('parrucchiere_id, prezzo_totale, parrucchieri(nome)')
    .gte('data_ora', `${from}T00:00:00`)
    .lte('data_ora', `${to}T23:59:59`)
    .is('deleted_at', null)
    .not('parrucchiere_id', 'is', null);

  if (error) return JSON.stringify({ errore: error.message });

  const stats: Record<string, { nome: string; appuntamenti: number; incasso: number }> = {};
  (apps || []).forEach((a: Record<string, unknown>) => {
    const pid = String(a.parrucchiere_id);
    const parr = a.parrucchieri as Record<string, string> | null;
    if (!stats[pid]) stats[pid] = { nome: parr?.nome || 'N/D', appuntamenti: 0, incasso: 0 };
    stats[pid].appuntamenti += 1;
    stats[pid].incasso += Number(a.prezzo_totale) || 0;
  });

  const classifica = Object.values(stats)
    .map(s => ({
      parrucchiere: s.nome,
      appuntamenti: s.appuntamenti,
      incasso_totale: s.incasso.toFixed(2),
      media_appuntamento: s.appuntamenti > 0 ? (s.incasso / s.appuntamenti).toFixed(2) : '0.00',
    }))
    .sort((a, b) => b.appuntamenti - a.appuntamenti);

  return JSON.stringify({ periodo, dal: from, al: to, parrucchieri: classifica });
}

async function cercaCliente(args: Record<string, unknown>): Promise<string> {
  const query = String(args.query || '').trim();

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select('id, nome, cognome, telefono, email, data_nascita, note')
    .is('deleted_at', null)
    .or(`nome.ilike.%${query}%,cognome.ilike.%${query}%,telefono.ilike.%${query}%`)
    .limit(5);

  if (error) return JSON.stringify({ errore: error.message });
  if (!clienti || clienti.length === 0)
    return JSON.stringify({ messaggio: `Nessun cliente trovato per "${query}".` });

  // Per ogni cliente recupera l'ultimo appuntamento
  const risultati = await Promise.all(
    clienti.map(async (c: Record<string, unknown>) => {
      const { data: ultApp } = await supabase
        .from('appuntamenti')
        .select('data_ora, stato')
        .eq('cliente_id', c.id as string)
        .is('deleted_at', null)
        .order('data_ora', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await supabase
        .from('appuntamenti')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', c.id as string)
        .is('deleted_at', null);

      return {
        nome: `${c.nome} ${c.cognome}`,
        telefono: c.telefono || null,
        email: c.email || null,
        data_nascita: c.data_nascita || null,
        note: c.note || null,
        totale_appuntamenti: count || 0,
        ultimo_appuntamento: ultApp
          ? new Date((ultApp as Record<string, string>).data_ora).toLocaleDateString('it-IT')
          : 'Mai',
      };
    })
  );

  return JSON.stringify({ trovati: risultati.length, clienti: risultati });
}

async function getClientiAssenti(args: Record<string, unknown>): Promise<string> {
  const giorni = Number(args.giorni) || 60;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - giorni);

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select('id, nome, cognome, telefono')
    .is('deleted_at', null);

  if (error) return JSON.stringify({ errore: error.message });

  const assenti: unknown[] = [];

  for (const c of (clienti || []) as Record<string, unknown>[]) {
    const { data: ultApp } = await supabase
      .from('appuntamenti')
      .select('data_ora')
      .eq('cliente_id', c.id as string)
      .is('deleted_at', null)
      .order('data_ora', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ultApp || new Date((ultApp as Record<string, string>).data_ora) < cutoff) {
      const ultimaVisita = ultApp
        ? new Date((ultApp as Record<string, string>).data_ora).toLocaleDateString('it-IT')
        : 'Mai venuto';
      const giorniAssenza = ultApp
        ? Math.floor((Date.now() - new Date((ultApp as Record<string, string>).data_ora).getTime()) / 86400000)
        : null;
      assenti.push({
        nome: `${c.nome} ${c.cognome}`,
        telefono: c.telefono || null,
        ultima_visita: ultimaVisita,
        giorni_assenza: giorniAssenza,
      });
    }
  }

  assenti.sort((a, b) => {
    const ga = (a as Record<string, unknown>).giorni_assenza as number | null;
    const gb = (b as Record<string, unknown>).giorni_assenza as number | null;
    if (ga === null) return -1;
    if (gb === null) return 1;
    return gb - ga;
  });

  return JSON.stringify({
    soglia_giorni: giorni,
    totale_assenti: assenti.length,
    clienti: assenti.slice(0, 20),
  });
}

async function getSlotLiberi(args: Record<string, unknown>): Promise<string> {
  const data = String(args.data);
  const durata = Number(args.durata_minuti) || 60;
  const from = `${data}T00:00:00`;
  const to = `${data}T23:59:59`;

  const { data: apps, error } = await supabase
    .from('appuntamenti')
    .select('data_ora, durata_minuti, parrucchieri(nome)')
    .gte('data_ora', new Date(from).toISOString())
    .lte('data_ora', new Date(to).toISOString())
    .is('deleted_at', null)
    .neq('stato', 'cancellato')
    .order('data_ora');

  if (error) return JSON.stringify({ errore: error.message });

  // Slot ogni 30 min dalle 8:00 alle 19:30
  const slotsOccupati: { inizio: number; fine: number }[] = (apps || []).map((a: Record<string, unknown>) => {
    const start = new Date(a.data_ora as string);
    const startMin = start.getHours() * 60 + start.getMinutes();
    return { inizio: startMin, fine: startMin + (Number(a.durata_minuti) || 60) };
  });

  const liberi: string[] = [];
  for (let min = 8 * 60; min <= 19 * 60; min += 30) {
    const fineSlot = min + durata;
    const occupato = slotsOccupati.some(s => min < s.fine && fineSlot > s.inizio);
    if (!occupato) {
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      liberi.push(`${h}:${m}`);
    }
  }

  return JSON.stringify({
    data,
    durata_minuti: durata,
    slot_liberi: liberi,
    totale_slot_liberi: liberi.length,
  });
}
