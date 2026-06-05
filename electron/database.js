import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db = null;

// ─── Carica better-sqlite3 gestendo sia dev che produzione packed ─────────────
function loadBetterSqlite3() {
  try {
    // In produzione packed, il .node si trova nell'unpacked folder
    if (app.isPackaged) {
      const unpackedPath = join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node'
      );
      if (existsSync(unpackedPath)) {
        // Forza il modulo a caricare il .node dalla posizione unpacked
        process.dlopen = undefined; // reset per forzare il percorso corretto
      }
    }
    return require('better-sqlite3');
  } catch (e) {
    console.error('[DB] Impossibile caricare better-sqlite3:', e);
    return null;
  }
}

export function initDatabase() {
  const BetterSqlite3 = loadBetterSqlite3();
  if (!BetterSqlite3) {
    console.warn('[DB] better-sqlite3 non disponibile, modalità solo-cloud attiva');
    return false;
  }

  const userData = app.getPath('userData');
  const dbDir = join(userData, 'database');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const dbPath = join(dbDir, 'gestionale.db');
  db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  createSchema();
  console.log('[DB] Database SQLite inizializzato:', dbPath);
  return true;
}

export function getDb() {
  return db;
}

function runMigrations() {
  // Rename ricariche_carte_premium → ricariche_carta_premium to match Supabase
  const oldExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ricariche_carte_premium'").get();
  if (oldExists) {
    const newExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ricariche_carta_premium'").get();
    if (!newExists) {
      db.exec('ALTER TABLE ricariche_carte_premium RENAME TO ricariche_carta_premium');
      console.log('[DB] Migrazione: ricariche_carte_premium → ricariche_carta_premium');
    }
  }
  // Add tipo_fiche and tipo_pagamento to fiches if missing
  try {
    const cols = db.prepare("PRAGMA table_info(fiches)").all().map(c => c.name);
    if (!cols.includes('tipo_fiche')) {
      db.exec("ALTER TABLE fiches ADD COLUMN tipo_fiche TEXT DEFAULT 'manuale'");
      console.log('[DB] Migrazione: aggiunta colonna tipo_fiche a fiches');
    }
    if (!cols.includes('tipo_pagamento')) {
      db.exec("ALTER TABLE fiches ADD COLUMN tipo_pagamento TEXT");
      console.log('[DB] Migrazione: aggiunta colonna tipo_pagamento a fiches');
    }
  } catch(e) { console.warn('[DB] migrazione fiches colonne:', e.message); }
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clienti (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      cognome TEXT NOT NULL DEFAULT '',
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      data_nascita TEXT,
      note TEXT DEFAULT '',
      foto_url TEXT DEFAULT '',
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS parrucchieri (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      colore TEXT NOT NULL DEFAULT '#888888',
      attivo INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS trattamenti_catalogo (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      descrizione TEXT DEFAULT '',
      durata_minuti INTEGER NOT NULL DEFAULT 60,
      prezzo REAL NOT NULL DEFAULT 0,
      colore TEXT NOT NULL DEFAULT '#888888',
      attivo INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appuntamenti (
      id TEXT PRIMARY KEY,
      cliente_id TEXT,
      parrucchiere_id TEXT,
      data_ora TEXT NOT NULL,
      durata_minuti INTEGER NOT NULL DEFAULT 60,
      stato TEXT NOT NULL DEFAULT 'confermato',
      note TEXT DEFAULT '',
      prezzo_totale REAL NOT NULL DEFAULT 0,
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (cliente_id) REFERENCES clienti(id),
      FOREIGN KEY (parrucchiere_id) REFERENCES parrucchieri(id)
    );

    CREATE TABLE IF NOT EXISTS appuntamento_trattamenti (
      id TEXT PRIMARY KEY,
      appuntamento_id TEXT NOT NULL,
      trattamento_id TEXT,
      nome_trattamento TEXT NOT NULL DEFAULT '',
      prezzo REAL NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (appuntamento_id) REFERENCES appuntamenti(id)
    );

    CREATE TABLE IF NOT EXISTS schede_colore (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      data_trattamento TEXT NOT NULL,
      formula_colore TEXT DEFAULT '',
      ossidante TEXT DEFAULT '',
      tempo_posa INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      colore_base TEXT DEFAULT '',
      colore_target TEXT DEFAULT '',
      tecnica TEXT DEFAULT '',
      foto_prima_url TEXT DEFAULT '',
      foto_dopo_url TEXT DEFAULT '',
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (cliente_id) REFERENCES clienti(id)
    );

    CREATE TABLE IF NOT EXISTS fiches (
      id TEXT PRIMARY KEY,
      appuntamento_id TEXT,
      cliente_id TEXT,
      note TEXT DEFAULT '',
      convalidata INTEGER NOT NULL DEFAULT 0,
      convalidata_at TEXT,
      importo_convalidato REAL NOT NULL DEFAULT 0,
      manuale INTEGER NOT NULL DEFAULT 0,
      data_riferimento TEXT,
      tipo_fiche TEXT DEFAULT 'manuale',
      tipo_pagamento TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fiche_voci (
      id TEXT PRIMARY KEY,
      fiche_id TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'servizio',
      nome_voce TEXT NOT NULL DEFAULT '',
      parrucchiere_id TEXT,
      nome_parrucchiere TEXT DEFAULT '',
      prezzo REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      ordine INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (fiche_id) REFERENCES fiches(id)
    );

    CREATE TABLE IF NOT EXISTS incassi (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fiche_id TEXT,
      cliente_nome TEXT DEFAULT '',
      importo REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS carte_sconto (
      id TEXT PRIMARY KEY,
      codice TEXT NOT NULL DEFAULT '',
      descrizione TEXT DEFAULT '',
      tipo_sconto TEXT NOT NULL DEFAULT 'percentuale',
      valore_sconto REAL NOT NULL DEFAULT 0,
      nominativa INTEGER NOT NULL DEFAULT 0,
      cliente_id TEXT,
      telefono_override TEXT DEFAULT '',
      attiva INTEGER NOT NULL DEFAULT 1,
      usa_e_getta INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS utilizzi_carta_sconto (
      id TEXT PRIMARY KEY,
      carta_sconto_id TEXT NOT NULL,
      fiche_id TEXT,
      importo_originale REAL NOT NULL DEFAULT 0,
      sconto_applicato REAL NOT NULL DEFAULT 0,
      importo_finale REAL NOT NULL DEFAULT 0,
      cliente_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS carte_premium (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      saldo REAL NOT NULL DEFAULT 0,
      attiva INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ricariche_carta_premium (
      id TEXT PRIMARY KEY,
      carta_premium_id TEXT NOT NULL,
      importo REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      tipo_ricarica TEXT DEFAULT 'manuale',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS utilizzi_carta_premium (
      id TEXT PRIMARY KEY,
      carta_premium_id TEXT NOT NULL,
      fiche_id TEXT,
      importo_detratto REAL NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prodotti_rivendita_catalogo (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      categoria TEXT DEFAULT '',
      prezzo_vendita REAL NOT NULL DEFAULT 0,
      prezzo_acquisto REAL DEFAULT 0,
      quantita_stock INTEGER NOT NULL DEFAULT 0,
      quantita_venduta INTEGER NOT NULL DEFAULT 0,
      attivo INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rivendita_prodotti (
      id TEXT PRIMARY KEY,
      fiche_id TEXT,
      parrucchiere_id TEXT,
      nome_prodotto TEXT NOT NULL DEFAULT '',
      quantita INTEGER NOT NULL DEFAULT 1,
      prezzo_unitario REAL NOT NULL DEFAULT 0,
      costo_unitario REAL DEFAULT 0,
      data_vendita TEXT NOT NULL,
      note TEXT DEFAULT '',
      catalogo_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS trattamenti_eseguiti (
      id TEXT PRIMARY KEY,
      fiche_id TEXT,
      parrucchiere_id TEXT,
      nome_trattamento TEXT NOT NULL DEFAULT '',
      prezzo REAL NOT NULL DEFAULT 0,
      data_esecuzione TEXT NOT NULL,
      note TEXT DEFAULT '',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS impostazioni (
      id TEXT PRIMARY KEY,
      chiave TEXT NOT NULL,
      valore TEXT,
      is_default INTEGER DEFAULT 0,
      ordine INTEGER DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1,
      UNIQUE(chiave, user_id)
    );

    CREATE TABLE IF NOT EXISTS template_messaggi (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      testo TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      ordine INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS assenze_parrucchieri (
      id TEXT PRIMARY KEY,
      parrucchiere_id TEXT NOT NULL,
      data_inizio TEXT NOT NULL,
      data_fine TEXT NOT NULL,
      note TEXT DEFAULT '',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS magazzino_prodotti (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      categoria TEXT DEFAULT '',
      quantita_attuale REAL NOT NULL DEFAULT 0,
      quantita_minima REAL DEFAULT 0,
      unita_misura TEXT DEFAULT 'pz',
      fornitore TEXT DEFAULT '',
      prezzo_acquisto REAL DEFAULT 0,
      note TEXT DEFAULT '',
      attivo INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS magazzino_movimenti (
      id TEXT PRIMARY KEY,
      prodotto_id TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'carico',
      quantita REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      data_movimento TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS magazzino_schede_salvate (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      dati TEXT NOT NULL DEFAULT '[]',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS spese_voci (
      id TEXT PRIMARY KEY,
      descrizione TEXT NOT NULL DEFAULT '',
      importo REAL NOT NULL DEFAULT 0,
      iva REAL DEFAULT 0,
      categoria TEXT DEFAULT '',
      data_spesa TEXT NOT NULL,
      ricorrente INTEGER NOT NULL DEFAULT 0,
      ricorrenza TEXT DEFAULT '',
      periodo_riferimento TEXT DEFAULT '',
      data_inizio TEXT,
      data_fine TEXT,
      note TEXT DEFAULT '',
      user_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS schede_clienti_da_confermare (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      cognome TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT '',
      data_nascita TEXT,
      note TEXT DEFAULT '',
      stato TEXT NOT NULL DEFAULT 'in_attesa',
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS giorni_parrucchiere (
      id TEXT PRIMARY KEY,
      data_specifica TEXT NOT NULL,
      parrucchiere_id TEXT NOT NULL,
      ordine INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS voci_extra_catalogo (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL DEFAULT '',
      prezzo REAL NOT NULL DEFAULT 0,
      attivo INTEGER NOT NULL DEFAULT 1,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      _dirty INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_appuntamenti_data ON appuntamenti(data_ora);
    CREATE INDEX IF NOT EXISTS idx_appuntamenti_cliente ON appuntamenti(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_fiches_appuntamento ON fiches(appuntamento_id);
    CREATE INDEX IF NOT EXISTS idx_fiche_voci_fiche ON fiche_voci(fiche_id);
    CREATE INDEX IF NOT EXISTS idx_clienti_cognome ON clienti(cognome, nome);
    CREATE INDEX IF NOT EXISTS idx_dirty ON clienti(_dirty) WHERE _dirty = 1;
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function generateId() {
  // UUID v4 semplificato
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── API database generica ────────────────────────────────────────────────────

/**
 * SELECT con filtri opzionali.
 * filters: array di { col, op, val } dove op è '=', '!=', '<', '<=', '>', '>=', 'in', 'is_null', 'not_null', 'gte', 'lte', 'neq', 'like'
 * orderBy: array di { col, asc }
 * select: stringa delle colonne (default '*')
 * joins: array di { table, on, columns } per LEFT JOIN semplici
 */
export function dbSelect({ table, columns = '*', filters = [], orderBy = [], limit = null, joins = [], countOnly = false }) {
  if (!db) return countOnly ? 0 : [];

  try {
    let sql;
    const params = [];

    if (countOnly) {
      sql = `SELECT COUNT(*) as cnt FROM ${table}`;
    } else if (joins.length > 0) {
      // Build column list with aliases per i join
      const colParts = [columns === '*' ? `${table}.*` : columns];
      for (const j of joins) {
        if (j.columns) colParts.push(j.columns);
      }
      sql = `SELECT ${colParts.join(', ')} FROM ${table}`;
      for (const j of joins) {
        sql += ` LEFT JOIN ${j.table} ON ${j.on}`;
      }
    } else {
      sql = `SELECT ${columns} FROM ${table}`;
    }

    const whereParts = [];
    for (const f of filters) {
      if (f.op === 'is_null') {
        whereParts.push(`${f.col} IS NULL`);
      } else if (f.op === 'not_null') {
        whereParts.push(`${f.col} IS NOT NULL`);
      } else if (f.op === 'in') {
        if (!f.val || f.val.length === 0) {
          whereParts.push('1=0'); // nessun risultato
        } else {
          const placeholders = f.val.map(() => '?').join(', ');
          whereParts.push(`${f.col} IN (${placeholders})`);
          params.push(...f.val);
        }
      } else if (f.op === '=' || f.op === 'eq') {
        whereParts.push(`${f.col} = ?`);
        params.push(f.val);
      } else if (f.op === '!=' || f.op === 'neq') {
        whereParts.push(`${f.col} != ?`);
        params.push(f.val);
      } else if (f.op === '>=' || f.op === 'gte') {
        whereParts.push(`${f.col} >= ?`);
        params.push(f.val);
      } else if (f.op === '<=' || f.op === 'lte') {
        whereParts.push(`${f.col} <= ?`);
        params.push(f.val);
      } else if (f.op === '>') {
        whereParts.push(`${f.col} > ?`);
        params.push(f.val);
      } else if (f.op === '<') {
        whereParts.push(`${f.col} < ?`);
        params.push(f.val);
      } else if (f.op === 'like') {
        whereParts.push(`${f.col} LIKE ?`);
        params.push(f.val);
      }
    }

    if (whereParts.length > 0) {
      sql += ' WHERE ' + whereParts.join(' AND ');
    }

    if (!countOnly && orderBy.length > 0) {
      const orderParts = orderBy.map(o => `${o.col} ${o.asc !== false ? 'ASC' : 'DESC'}`);
      sql += ' ORDER BY ' + orderParts.join(', ');
    }

    if (!countOnly && limit !== null) {
      sql += ` LIMIT ${parseInt(limit)}`;
    }

    if (countOnly) {
      const row = db.prepare(sql).get(...params);
      return row ? row.cnt : 0;
    }

    return db.prepare(sql).all(...params);
  } catch (e) {
    console.error(`[DB] SELECT ${table} error:`, e);
    return countOnly ? 0 : [];
  }
}

export function dbInsert({ table, data, userId }) {
  if (!db) return null;
  try {
    const id = data.id || generateId();
    const ts = now();
    const row = { ...data, id, user_id: userId || data.user_id, created_at: ts, updated_at: ts, _dirty: 1 };

    const cols = Object.keys(row).filter(k => row[k] !== undefined);
    const placeholders = cols.map(() => '?').join(', ');
    const vals = cols.map(k => {
      const v = row[k];
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });

    db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
    return dbSelect({ table, filters: [{ col: 'id', op: '=', val: id }] })[0] || null;
  } catch (e) {
    console.error(`[DB] INSERT ${table} error:`, e);
    return null;
  }
}

export function dbUpdate({ table, id, data }) {
  if (!db) return null;
  try {
    const ts = now();
    const updates = { ...data, updated_at: ts, _dirty: 1 };
    const cols = Object.keys(updates).filter(k => updates[k] !== undefined && k !== 'id');
    const setParts = cols.map(k => `${k} = ?`).join(', ');
    const vals = cols.map(k => {
      const v = updates[k];
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    });

    db.prepare(`UPDATE ${table} SET ${setParts} WHERE id = ?`).run(...vals, id);
    return dbSelect({ table, filters: [{ col: 'id', op: '=', val: id }] })[0] || null;
  } catch (e) {
    console.error(`[DB] UPDATE ${table} error:`, e);
    return null;
  }
}

export function dbDelete({ table, filters }) {
  if (!db) return false;
  try {
    const whereParts = [];
    const params = [];
    for (const f of filters) {
      if (f.op === '=' || f.op === 'eq') {
        whereParts.push(`${f.col} = ?`);
        params.push(f.val);
      } else if (f.op === 'in') {
        const placeholders = f.val.map(() => '?').join(', ');
        whereParts.push(`${f.col} IN (${placeholders})`);
        params.push(...f.val);
      }
    }
    const sql = `DELETE FROM ${table} WHERE ${whereParts.join(' AND ')}`;
    db.prepare(sql).run(...params);
    return true;
  } catch (e) {
    console.error(`[DB] DELETE ${table} error:`, e);
    return false;
  }
}

export function dbUpsert({ table, data, onConflict, userId }) {
  if (!db) return null;
  try {
    const ts = now();
    const existing = onConflict
      ? (() => {
          const parts = onConflict.split(',').map(c => c.trim());
          const filters = parts.map(col => ({ col, op: '=', val: data[col] })).filter(f => f.val !== undefined);
          if (filters.length === 0) return null;
          const rows = dbSelect({ table, filters });
          return rows.length > 0 ? rows[0] : null;
        })()
      : null;

    if (existing) {
      return dbUpdate({ table, id: existing.id, data: { ...data, updated_at: ts } });
    } else {
      return dbInsert({ table, data: { ...data, id: data.id || generateId() }, userId });
    }
  } catch (e) {
    console.error(`[DB] UPSERT ${table} error:`, e);
    return null;
  }
}

export function dbBulkInsert({ table, rows, userId }) {
  if (!db || !rows || rows.length === 0) return 0;
  const insertOne = db.transaction((row) => {
    dbInsert({ table, data: row, userId });
  });
  const insertAll = db.transaction((allRows) => {
    let count = 0;
    for (const row of allRows) {
      insertOne(row);
      count++;
    }
    return count;
  });
  return insertAll(rows);
}

// Usato dal sync: inserisce/aggiorna dati da Supabase senza marcarli dirty
export function dbSyncUpsert({ table, rows }) {
  if (!db || !rows || rows.length === 0) return;
  const upsertOne = db.transaction((row) => {
    const cols = Object.keys(row).filter(k => k !== '_dirty' && row[k] !== undefined);
    const allCols = [...cols, 'synced_at', '_dirty'];
    const placeholders = allCols.map(() => '?').join(', ');
    const vals = [
      ...cols.map(k => {
        const v = row[k];
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v;
      }),
      now(),
      0, // non dirty: viene da Supabase
    ];
    db.prepare(
      `INSERT OR REPLACE INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})`
    ).run(...vals);
  });

  const upsertAll = db.transaction((allRows) => {
    for (const row of allRows) upsertOne(row);
  });
  upsertAll(rows);
}

// Restituisce tutte le righe dirty (da sincronizzare verso Supabase)
export function getDirtyRows(table) {
  if (!db) return [];
  try {
    return db.prepare(`SELECT * FROM ${table} WHERE _dirty = 1`).all();
  } catch {
    return [];
  }
}

// Marca le righe come sincronizzate
export function markSynced(table, ids) {
  if (!db || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`UPDATE ${table} SET _dirty = 0, synced_at = ? WHERE id IN (${placeholders})`).run(now(), ...ids);
}

// Importa un backup JSON nel database locale (usato per ripristino offline)
export function importBackup(backupData) {
  if (!db) return { success: false, error: 'Database non disponibile' };

  const TABLE_MAP = {
    clienti: 'clienti',
    parrucchieri: 'parrucchieri',
    trattamenti_catalogo: 'trattamenti_catalogo',
    appuntamenti: 'appuntamenti',
    appuntamento_trattamenti: 'appuntamento_trattamenti',
    schede_colore: 'schede_colore',
    fiches: 'fiches',
    fiche_voci: 'fiche_voci',
    incassi: 'incassi',
    carte_sconto: 'carte_sconto',
    utilizzi_carta_sconto: 'utilizzi_carta_sconto',
    carte_premium: 'carte_premium',
    ricariche_carta_premium: 'ricariche_carta_premium',
    utilizzi_carta_premium: 'utilizzi_carta_premium',
    prodotti_rivendita_catalogo: 'prodotti_rivendita_catalogo',
    rivendita_prodotti: 'rivendita_prodotti',
    trattamenti_eseguiti: 'trattamenti_eseguiti',
    impostazioni: 'impostazioni',
    template_messaggi: 'template_messaggi',
    assenze_parrucchieri: 'assenze_parrucchieri',
    magazzino_prodotti: 'magazzino_prodotti',
    magazzino_movimenti: 'magazzino_movimenti',
    magazzino_schede_salvate: 'magazzino_schede_salvate',
    spese_voci: 'spese_voci',
    schede_clienti_da_confermare: 'schede_clienti_da_confermare',
    giorni_parrucchiere: 'giorni_parrucchiere',
    voci_extra_catalogo: 'voci_extra_catalogo',
  };

  const results = {};
  const doImport = db.transaction(() => {
    for (const [key, localTable] of Object.entries(TABLE_MAP)) {
      const rows = backupData[key];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      try {
        dbSyncUpsert({ table: localTable, rows });
        results[key] = { ok: true, count: rows.length };
      } catch (e) {
        results[key] = { ok: false, error: String(e) };
      }
    }
  });

  try {
    doImport();
    return { success: true, results };
  } catch (e) {
    return { success: false, error: String(e), results };
  }
}

// Esporta tutti i dati locali come oggetto JSON (per backup)
export function exportLocalData() {
  if (!db) return null;
  const TABLES = [
    'clienti', 'parrucchieri', 'trattamenti_catalogo', 'appuntamenti',
    'appuntamento_trattamenti', 'schede_colore', 'fiches', 'fiche_voci',
    'incassi', 'carte_sconto', 'utilizzi_carta_sconto', 'carte_premium',
    'ricariche_carta_premium', 'utilizzi_carta_premium', 'prodotti_rivendita_catalogo',
    'rivendita_prodotti', 'trattamenti_eseguiti', 'impostazioni', 'template_messaggi',
    'assenze_parrucchieri', 'magazzino_prodotti', 'magazzino_movimenti',
    'magazzino_schede_salvate', 'spese_voci', 'schede_clienti_da_confermare',
    'giorni_parrucchiere', 'voci_extra_catalogo',
  ];
  const out = {};
  for (const t of TABLES) {
    try {
      out[t] = db.prepare(`SELECT * FROM ${t}`).all();
    } catch {
      out[t] = [];
    }
  }
  return out;
}
