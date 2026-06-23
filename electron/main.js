import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { createRequire } from 'module';
import { pbkdf2Sync, randomBytes, createHash } from 'crypto';
import { cpus, networkInterfaces, hostname } from 'os';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

// ─── Deep link protocol ───────────────────────────────────────────────────────
const PROTOCOL = 'gestionale-salone';
if (!isDev) app.setAsDefaultProtocolClient(PROTOCOL);
let pendingDeepLink = null;

function handleDeepLink(url) {
  if (!url || !url.startsWith(`${PROTOCOL}://`)) return;
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingDeepLink = url;
  }
}

app.on('second-instance', (_event, argv) => {
  const url = argv.find(a => a.startsWith(`${PROTOCOL}://`));
  if (url) handleDeepLink(url);
  if (mainWindow) { mainWindow.show(); if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});
app.on('open-url', (_event, url) => handleDeepLink(url));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

// ─── Config backup automatico ─────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const CONFIG_PATH = join(USER_DATA, 'auto-backup-config.json');

function readConfig() {
  try { if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); }
  catch { /* ignore */ }
  return { enabled: false, time: '08:00', days: [1, 2, 3, 4, 5], last: '', folder: '' };
}
function writeConfig(cfg) { writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8'); }

// ─── Config cartelle di salvataggio ──────────────────────────────────────────
const SAVE_PATHS_CONFIG_PATH = join(USER_DATA, 'save-paths-config.json');
const DEFAULT_SAVE_PATHS = { backup: '', fiches: '', fiches_nero: '', fiches_tutte: '', fiches_dichiarate: '', fiches_non_dichiarate: '', fiches_xls_tutte: '', fiches_xls_dichiarate: '', fiches_xls_non_dichiarate: '', clienti: '', finanze: '', magazzino: '', rivendita: '', statistiche: '', qrcode: '', comunicazioni: '' };

function readSavePaths() {
  try { if (existsSync(SAVE_PATHS_CONFIG_PATH)) return { ...DEFAULT_SAVE_PATHS, ...JSON.parse(readFileSync(SAVE_PATHS_CONFIG_PATH, 'utf8')) }; }
  catch { /* ignore */ }
  return { ...DEFAULT_SAVE_PATHS };
}
function writeSavePaths(paths) { writeFileSync(SAVE_PATHS_CONFIG_PATH, JSON.stringify(paths, null, 2), 'utf8'); }

// ─── Profili locali offline ───────────────────────────────────────────────────
const LOCAL_PROFILES_PATH = join(USER_DATA, 'local-profiles.json');

function readLocalProfiles() {
  try {
    if (existsSync(LOCAL_PROFILES_PATH)) {
      return JSON.parse(readFileSync(LOCAL_PROFILES_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return [];
}

function writeLocalProfiles(profiles) {
  writeFileSync(LOCAL_PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  return pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

// ─── Migrazione database locale: vecchio userId → nuovo userId Supabase ────────
// Rinomina la cartella database/<oldUserId>/ in database/<newUserId>/,
// aggiorna user_id in tutte le tabelle SQLite e marca _dirty=1 cosi'
// la sync successiva carichera' tutto su Supabase col nuovo UUID.
function migrateLocalDatabase(oldUserId, newUserId) {
  try {
    const oldDir = join(USER_DATA, 'database', oldUserId);
    const newDir = join(USER_DATA, 'database', newUserId);

    if (!existsSync(oldDir)) {
      console.log('[Migration] Nessuna cartella locale per', oldUserId);
      return false;
    }
    if (existsSync(newDir)) {
      // Race condition: openDatabase(newUserId) può aver già creato la cartella con un DB
      // vuoto appena prima di questa migrazione. Se il DB nuovo è vuoto (nessuna riga con
      // newUserId) lo rimuoviamo per poter rinominare la cartella vecchia.
      let Database2;
      try { Database2 = loadBetterSqlite3(); } catch { Database2 = null; }
      let newDbIsEmpty = true;
      if (Database2) {
        const newDbPath = join(newDir, 'gestionale.db');
        if (existsSync(newDbPath)) {
          try {
            const checkDb = new Database2(newDbPath);
            // Controlla se c'e' qualche riga con newUserId in clienti (tabella sempre presente)
            try {
              const row = checkDb.prepare('SELECT COUNT(*) as n FROM clienti WHERE user_id = ?').get(newUserId);
              if (row && row.n > 0) newDbIsEmpty = false;
            } catch { /* tabella non esiste, DB è vuoto */ }
            checkDb.close();
          } catch { /* non leggibile, assumi vuoto */ }
        }
      }
      if (!newDbIsEmpty) {
        console.log('[Migration] Cartella destinazione già esistente con dati:', newDir);
        return false;
      }
      // Rimuovi la cartella vuota per procedere con la rinomina
      if (db) {
        try { db.close(); } catch { /* ignora */ }
        db = null;
        dbReady = false;
      }
      try { rmSync(newDir, { recursive: true, force: true }); } catch (e) {
        console.error('[Migration] Impossibile rimuovere cartella vuota:', e);
        return false;
      }
    }

    // Chiudi il DB se e' aperto sulla vecchia cartella
    if (db) {
      try { db.close(); } catch { /* ignora */ }
      db = null;
      dbReady = false;
    }

    // Rinomina la cartella (zero copie, zero perdita dati)
    renameSync(oldDir, newDir);
    console.log('[Migration] Cartella rinominata:', oldDir, '→', newDir);

    // Aggiorna user_id in tutte le tabelle e marca _dirty=1 per la sync
    let Database;
    try { Database = loadBetterSqlite3(); } catch { Database = null; }
    if (!Database) return true; // rinomina avvenuta, update user_id non possibile senza SQLite

    const dbPath = join(newDir, 'gestionale.db');
    if (!existsSync(dbPath)) return true;

    const tmpDb = new Database(dbPath);
    const TABLES_TO_MIGRATE = [
      'clienti', 'parrucchieri', 'trattamenti_catalogo', 'appuntamenti',
      'appuntamento_trattamenti', 'schede_colore', 'fiches', 'fiche_voci',
      'incassi', 'incassi_giornalieri', 'carte_sconto', 'utilizzi_carta_sconto',
      'carte_premium', 'ricariche_carta_premium', 'utilizzi_carta_premium',
      'prodotti_rivendita_catalogo', 'rivendita_prodotti', 'trattamenti_eseguiti',
      'impostazioni', 'template_messaggi', 'assenze_parrucchieri',
      'magazzino_prodotti', 'magazzino_movimenti', 'magazzino_schede_salvate',
      'spese', 'schede_clienti_da_confermare', 'giorni_parrucchieri',
      'voci_extra_catalogo',
    ];

    const updateAll = tmpDb.transaction(() => {
      for (const table of TABLES_TO_MIGRATE) {
        try {
          // Aggiorna le righe col vecchio userId
          tmpDb.prepare(`UPDATE ${table} SET user_id = ?, _dirty = 1 WHERE user_id = ?`)
            .run(newUserId, oldUserId);
          // Aggiorna anche le righe senza user_id (create offline prima che il concetto esistesse)
          tmpDb.prepare(`UPDATE ${table} SET user_id = ?, _dirty = 1 WHERE user_id IS NULL`)
            .run(newUserId);
        } catch { /* tabella potrebbe non esistere ancora — ignorare */ }
      }
    });
    updateAll();
    tmpDb.close();

    console.log('[Migration] user_id aggiornato da', oldUserId, 'a', newUserId, 'in tutte le tabelle');
    return true;
  } catch (e) {
    console.error('[Migration] Errore durante la migrazione:', e);
    return false;
  }
}

// ─── Config auto-salvataggio fiches ──────────────────────────────────────────
const FICHES_SCHED_PATH = join(USER_DATA, 'fiches-sched-config.json');

function readFichesSched() {
  try { if (existsSync(FICHES_SCHED_PATH)) return JSON.parse(readFileSync(FICHES_SCHED_PATH, 'utf8')); }
  catch { /* ignore */ }
  return { enabled: false, time: '20:00', days: [1, 2, 3, 4, 5], last: '' };
}
function writeFichesSched(cfg) { writeFileSync(FICHES_SCHED_PATH, JSON.stringify(cfg, null, 2), 'utf8'); }

// ─── Database SQLite ──────────────────────────────────────────────────────────
let db = null;
let dbReady = false;

function loadBetterSqlite3() {
  const candidates = app.isPackaged ? [
    // asar: false → risorse nella cartella app/
    join(app.getAppPath(), 'node_modules', 'better-sqlite3'),
    join(process.resourcesPath, 'app', 'node_modules', 'better-sqlite3'),
    join(__dirname, '..', 'node_modules', 'better-sqlite3'),
    // asar: true → risorse in app.asar.unpacked/
    join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3'),
  ] : [];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        const mod = require(p);
        console.log('[DB] better-sqlite3 caricato da:', p);
        return mod;
      }
    } catch (e) {
      console.warn('[DB] Percorso non valido:', p, e.message);
    }
  }
  // Fallback: richiesta diretta (funziona in dev)
  try { return require('better-sqlite3'); } catch (e) {
    console.error('[DB] better-sqlite3 non disponibile:', e.message);
    return null;
  }
}

function openDatabase(userId) {
  const Database = loadBetterSqlite3();
  if (!Database) {
    console.warn('[DB] better-sqlite3 non disponibile — esegui "npm run electron:rebuild" prima del build.');
    return false;
  }
  try {
    // Se userId e' fornito, usa una sottocartella dedicata per isolare i dati
    const dbDir = userId
      ? join(USER_DATA, 'database', userId)
      : join(USER_DATA, 'database');
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, 'gestionale.db');
    if (db) {
      try { db.close(); } catch { /* ignora */ }
      db = null;
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations();
    createSchema();
    console.log('[DB] SQLite inizializzato:', dbPath);
    return true;
  } catch (e) {
    console.error('[DB] Errore inizializzazione:', e);
    return false;
  }
}

function initDatabase() {
  return openDatabase(null);
}

function nowIso() { return new Date().toISOString(); }
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function runMigrations() {
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

  // Add blacklist columns to clienti if missing
  try {
    const clientiCols = db.prepare("PRAGMA table_info(clienti)").all().map(c => c.name);
    if (!clientiCols.includes('in_blacklist')) {
      db.exec("ALTER TABLE clienti ADD COLUMN in_blacklist INTEGER NOT NULL DEFAULT 0");
      console.log('[DB] Migrazione: aggiunta colonna in_blacklist a clienti');
    }
    if (!clientiCols.includes('motivo_blacklist')) {
      db.exec("ALTER TABLE clienti ADD COLUMN motivo_blacklist TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna motivo_blacklist a clienti');
    }
    if (!clientiCols.includes('foto_base64')) {
      db.exec("ALTER TABLE clienti ADD COLUMN foto_base64 TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_base64 a clienti');
    }
    if (!clientiCols.includes('foto_base64_pendente')) {
      db.exec("ALTER TABLE clienti ADD COLUMN foto_base64_pendente TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_base64_pendente a clienti');
    }
  } catch(e) { console.warn('[DB] migrazione clienti colonne:', e.message); }

  // Add foto_base64 columns to schede_colore if missing
  try {
    const schedeCols = db.prepare("PRAGMA table_info(schede_colore)").all().map(c => c.name);
    if (!schedeCols.includes('foto_prima_base64')) {
      db.exec("ALTER TABLE schede_colore ADD COLUMN foto_prima_base64 TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_prima_base64 a schede_colore');
    }
    if (!schedeCols.includes('foto_dopo_base64')) {
      db.exec("ALTER TABLE schede_colore ADD COLUMN foto_dopo_base64 TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_dopo_base64 a schede_colore');
    }
  } catch(e) { console.warn('[DB] migrazione schede_colore colonne:', e.message); }

  // Add tipo column to trattamenti_catalogo if missing
  try {
    const tratCols = db.prepare("PRAGMA table_info(trattamenti_catalogo)").all().map(c => c.name);
    if (!tratCols.includes('tipo')) {
      db.exec("ALTER TABLE trattamenti_catalogo ADD COLUMN tipo TEXT NOT NULL DEFAULT 'servizio'");
      console.log('[DB] Migrazione: aggiunta colonna tipo a trattamenti_catalogo');
    }
  } catch(e) { console.warn('[DB] migrazione trattamenti_catalogo tipo:', e.message); }

  // Add deleted_at, totale to rivendita_prodotti if missing
  try {
    const rivCols = db.prepare("PRAGMA table_info(rivendita_prodotti)").all().map(c => c.name);
    if (!rivCols.includes('deleted_at')) {
      db.exec("ALTER TABLE rivendita_prodotti ADD COLUMN deleted_at TEXT");
      console.log('[DB] Migrazione: aggiunta colonna deleted_at a rivendita_prodotti');
    }
    if (!rivCols.includes('totale')) {
      db.exec("ALTER TABLE rivendita_prodotti ADD COLUMN totale REAL");
      db.exec("UPDATE rivendita_prodotti SET totale = prezzo_unitario * quantita WHERE totale IS NULL");
      console.log('[DB] Migrazione: aggiunta colonna totale a rivendita_prodotti');
    }
  } catch(e) { console.warn('[DB] migrazione rivendita_prodotti:', e.message); }

  // Add marca, quantita_minima, foto_url, foto_base64_pendente, best_seller, quiz_tags to prodotti_rivendita_catalogo if missing
  try {
    const catCols = db.prepare("PRAGMA table_info(prodotti_rivendita_catalogo)").all().map(c => c.name);
    if (!catCols.includes('marca')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN marca TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna marca a prodotti_rivendita_catalogo');
    }
    if (!catCols.includes('quantita_minima')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN quantita_minima INTEGER NOT NULL DEFAULT 0");
      console.log('[DB] Migrazione: aggiunta colonna quantita_minima a prodotti_rivendita_catalogo');
    }
    if (!catCols.includes('foto_url')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN foto_url TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_url a prodotti_rivendita_catalogo');
    }
    if (!catCols.includes('foto_base64_pendente')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN foto_base64_pendente TEXT DEFAULT ''");
      console.log('[DB] Migrazione: aggiunta colonna foto_base64_pendente a prodotti_rivendita_catalogo');
    }
    if (!catCols.includes('best_seller')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN best_seller INTEGER NOT NULL DEFAULT 0");
      console.log('[DB] Migrazione: aggiunta colonna best_seller a prodotti_rivendita_catalogo');
    }
    if (!catCols.includes('quiz_tags')) {
      db.exec("ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN quiz_tags TEXT DEFAULT '[]'");
      console.log('[DB] Migrazione: aggiunta colonna quiz_tags a prodotti_rivendita_catalogo');
    }
  } catch(e) { console.warn('[DB] migrazione prodotti_rivendita_catalogo:', e.message); }

  // Rinomina spese_voci → spese per allineamento con Supabase
  try {
    const speseVociExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spese_voci'").get();
    const speseExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='spese'").get();
    if (speseVociExists && !speseExists) {
      db.exec('ALTER TABLE spese_voci RENAME TO spese');
      console.log('[DB] Migrazione: spese_voci → spese');
    }
  } catch(e) { console.warn('[DB] migrazione spese_voci→spese:', e.message); }

  // Rinomina giorni_parrucchiere → giorni_parrucchieri per allineamento con Supabase
  try {
    const vecchiaExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='giorni_parrucchiere'").get();
    const nuovaExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='giorni_parrucchieri'").get();
    if (vecchiaExists && !nuovaExists) {
      db.exec('ALTER TABLE giorni_parrucchiere RENAME TO giorni_parrucchieri');
      console.log('[DB] Migrazione: giorni_parrucchiere → giorni_parrucchieri');
    }
  } catch(e) { console.warn('[DB] migrazione giorni_parrucchieri:', e.message); }

  // Create pending_deletes table if missing (for offline delete sync)
  try {
    const pdExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_deletes'").get();
    if (!pdExists) {
      db.exec(`
        CREATE TABLE pending_deletes (
          id TEXT PRIMARY KEY, table_name TEXT NOT NULL, record_id TEXT NOT NULL,
          deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_pending_deletes_table ON pending_deletes(table_name);
      `);
      console.log('[DB] Migrazione: creata tabella pending_deletes');
    }
  } catch(e) { console.warn('[DB] migrazione pending_deletes:', e.message); }

  // Create incassi_giornalieri table if missing (was previously named 'incassi')
  try {
    const igExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='incassi_giornalieri'").get();
    if (!igExists) {
      db.exec(`
        CREATE TABLE incassi_giornalieri (
          id TEXT PRIMARY KEY, data TEXT NOT NULL, fiche_id TEXT, cliente_nome TEXT NOT NULL DEFAULT '',
          importo REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', user_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_incassi_giornalieri_data ON incassi_giornalieri(data);
        CREATE INDEX IF NOT EXISTS idx_incassi_giornalieri_fiche ON incassi_giornalieri(fiche_id);
      `);
      console.log('[DB] Migrazione: creata tabella incassi_giornalieri');
    }
  } catch(e) { console.warn('[DB] migrazione incassi_giornalieri:', e.message); }

  // Add tipo_pagamento and importo_pagato to ricariche_carta_premium if missing
  try {
    const ricCols = db.prepare("PRAGMA table_info(ricariche_carta_premium)").all().map(c => c.name);
    if (!ricCols.includes('tipo_pagamento')) {
      db.exec("ALTER TABLE ricariche_carta_premium ADD COLUMN tipo_pagamento TEXT DEFAULT NULL");
      console.log('[DB] Migrazione: aggiunta colonna tipo_pagamento a ricariche_carta_premium');
    }
    if (!ricCols.includes('importo_pagato')) {
      db.exec("ALTER TABLE ricariche_carta_premium ADD COLUMN importo_pagato REAL DEFAULT NULL");
      console.log('[DB] Migrazione: aggiunta colonna importo_pagato a ricariche_carta_premium');
    }
  } catch(e) { console.warn('[DB] migrazione ricariche_carta_premium colonne:', e.message); }

  // Add tipo_pagamento_creazione to carte_premium if missing
  try {
    const carteCols = db.prepare("PRAGMA table_info(carte_premium)").all().map(c => c.name);
    if (!carteCols.includes('tipo_pagamento_creazione')) {
      db.exec("ALTER TABLE carte_premium ADD COLUMN tipo_pagamento_creazione TEXT DEFAULT NULL");
      console.log('[DB] Migrazione: aggiunta colonna tipo_pagamento_creazione a carte_premium');
    }
  } catch(e) { console.warn('[DB] migrazione carte_premium tipo_pagamento_creazione:', e.message); }
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clienti (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', cognome TEXT NOT NULL DEFAULT '',
      telefono TEXT DEFAULT '', email TEXT DEFAULT '', data_nascita TEXT,
      note TEXT DEFAULT '', foto_url TEXT DEFAULT '',
      foto_base64 TEXT DEFAULT '', foto_base64_pendente TEXT DEFAULT '',
      in_blacklist INTEGER NOT NULL DEFAULT 0, motivo_blacklist TEXT DEFAULT '',
      user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS parrucchieri (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', colore TEXT NOT NULL DEFAULT '#888888',
      attivo INTEGER NOT NULL DEFAULT 1, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS trattamenti_catalogo (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', descrizione TEXT DEFAULT '',
      durata_minuti INTEGER NOT NULL DEFAULT 60, prezzo REAL NOT NULL DEFAULT 0,
      colore TEXT NOT NULL DEFAULT '#888888', attivo INTEGER NOT NULL DEFAULT 1,
      tipo TEXT NOT NULL DEFAULT 'servizio', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS appuntamenti (
      id TEXT PRIMARY KEY, cliente_id TEXT, parrucchiere_id TEXT,
      data_ora TEXT NOT NULL, durata_minuti INTEGER NOT NULL DEFAULT 60,
      stato TEXT NOT NULL DEFAULT 'confermato', note TEXT DEFAULT '',
      prezzo_totale REAL NOT NULL DEFAULT 0, user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS appuntamento_trattamenti (
      id TEXT PRIMARY KEY, appuntamento_id TEXT NOT NULL, trattamento_id TEXT,
      nome_trattamento TEXT NOT NULL DEFAULT '', prezzo REAL NOT NULL DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS schede_colore (
      id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, data_trattamento TEXT NOT NULL,
      formula_colore TEXT DEFAULT '', ossidante TEXT DEFAULT '', tempo_posa INTEGER DEFAULT 0,
      note TEXT DEFAULT '', colore_base TEXT DEFAULT '', colore_target TEXT DEFAULT '',
      tecnica TEXT DEFAULT '', foto_prima_url TEXT DEFAULT '', foto_dopo_url TEXT DEFAULT '',
      foto_prima_base64 TEXT DEFAULT '', foto_dopo_base64 TEXT DEFAULT '',
      user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS fiches (
      id TEXT PRIMARY KEY, appuntamento_id TEXT, cliente_id TEXT, note TEXT DEFAULT '',
      convalidata INTEGER NOT NULL DEFAULT 0, convalidata_at TEXT,
      importo_convalidato REAL NOT NULL DEFAULT 0, manuale INTEGER NOT NULL DEFAULT 0,
      data_riferimento TEXT, tipo_fiche TEXT DEFAULT 'manuale', tipo_pagamento TEXT, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS fiche_voci (
      id TEXT PRIMARY KEY, fiche_id TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'servizio',
      nome_voce TEXT NOT NULL DEFAULT '', parrucchiere_id TEXT, nome_parrucchiere TEXT DEFAULT '',
      prezzo REAL NOT NULL DEFAULT 0, note TEXT DEFAULT '', ordine INTEGER NOT NULL DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS incassi (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, fiche_id TEXT, cliente_nome TEXT DEFAULT '',
      importo REAL NOT NULL DEFAULT 0, note TEXT DEFAULT '', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS incassi_giornalieri (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, fiche_id TEXT, cliente_nome TEXT NOT NULL DEFAULT '',
      importo REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_incassi_giornalieri_data ON incassi_giornalieri(data);
    CREATE INDEX IF NOT EXISTS idx_incassi_giornalieri_fiche ON incassi_giornalieri(fiche_id);
    CREATE TABLE IF NOT EXISTS carte_sconto (
      id TEXT PRIMARY KEY, codice TEXT NOT NULL DEFAULT '', descrizione TEXT DEFAULT '',
      tipo_sconto TEXT NOT NULL DEFAULT 'percentuale', valore_sconto REAL NOT NULL DEFAULT 0,
      nominativa INTEGER NOT NULL DEFAULT 0, cliente_id TEXT, telefono_override TEXT DEFAULT '',
      attiva INTEGER NOT NULL DEFAULT 1, usa_e_getta INTEGER NOT NULL DEFAULT 0, user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS utilizzi_carta_sconto (
      id TEXT PRIMARY KEY, carta_sconto_id TEXT NOT NULL, fiche_id TEXT,
      importo_originale REAL NOT NULL DEFAULT 0, sconto_applicato REAL NOT NULL DEFAULT 0,
      importo_finale REAL NOT NULL DEFAULT 0, cliente_id TEXT, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS carte_premium (
      id TEXT PRIMARY KEY, cliente_id TEXT NOT NULL, saldo REAL NOT NULL DEFAULT 0,
      attiva INTEGER NOT NULL DEFAULT 1, tipo_pagamento_creazione TEXT DEFAULT NULL,
      user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS ricariche_carta_premium (
      id TEXT PRIMARY KEY, carta_premium_id TEXT NOT NULL, importo REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '', tipo_ricarica TEXT DEFAULT 'manuale',
      tipo_pagamento TEXT DEFAULT NULL, importo_pagato REAL DEFAULT NULL,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS utilizzi_carta_premium (
      id TEXT PRIMARY KEY, carta_premium_id TEXT NOT NULL, fiche_id TEXT,
      importo_detratto REAL NOT NULL DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS prodotti_rivendita_catalogo (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', marca TEXT DEFAULT '',
      categoria TEXT DEFAULT '', prezzo_vendita REAL NOT NULL DEFAULT 0, prezzo_acquisto REAL DEFAULT 0,
      quantita_stock INTEGER NOT NULL DEFAULT 0, quantita_venduta INTEGER NOT NULL DEFAULT 0,
      quantita_minima INTEGER NOT NULL DEFAULT 0, attivo INTEGER NOT NULL DEFAULT 1,
      foto_url TEXT DEFAULT '', foto_base64_pendente TEXT DEFAULT '',
      best_seller INTEGER NOT NULL DEFAULT 0, quiz_tags TEXT DEFAULT '[]',
      user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS rivendita_prodotti (
      id TEXT PRIMARY KEY, fiche_id TEXT, parrucchiere_id TEXT,
      nome_prodotto TEXT NOT NULL DEFAULT '', quantita INTEGER NOT NULL DEFAULT 1,
      prezzo_unitario REAL NOT NULL DEFAULT 0, costo_unitario REAL DEFAULT 0,
      totale REAL, data_vendita TEXT NOT NULL, note TEXT DEFAULT '', catalogo_id TEXT, user_id TEXT,
      deleted_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS trattamenti_eseguiti (
      id TEXT PRIMARY KEY, fiche_id TEXT, parrucchiere_id TEXT,
      nome_trattamento TEXT NOT NULL DEFAULT '', prezzo REAL NOT NULL DEFAULT 0,
      data_esecuzione TEXT NOT NULL, note TEXT DEFAULT '', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS impostazioni (
      id TEXT PRIMARY KEY, chiave TEXT NOT NULL, valore TEXT, is_default INTEGER DEFAULT 0,
      ordine INTEGER DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1, UNIQUE(chiave, user_id)
    );
    CREATE TABLE IF NOT EXISTS template_messaggi (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', testo TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0, ordine INTEGER NOT NULL DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS assenze_parrucchieri (
      id TEXT PRIMARY KEY, parrucchiere_id TEXT NOT NULL, data_inizio TEXT NOT NULL,
      data_fine TEXT NOT NULL, note TEXT DEFAULT '', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS magazzino_categorie (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', colore TEXT DEFAULT '#6B7280',
      ordine INTEGER DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS magazzino_prodotti (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', categoria TEXT DEFAULT '',
      quantita_attuale REAL NOT NULL DEFAULT 0, quantita_minima REAL DEFAULT 0,
      unita_misura TEXT DEFAULT 'pz', fornitore TEXT DEFAULT '', prezzo_acquisto REAL DEFAULT 0,
      note TEXT DEFAULT '', attivo INTEGER NOT NULL DEFAULT 1, user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS magazzino_movimenti (
      id TEXT PRIMARY KEY, prodotto_id TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'carico',
      quantita REAL NOT NULL DEFAULT 0, note TEXT DEFAULT '', data_movimento TEXT NOT NULL, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS magazzino_schede_salvate (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', dati TEXT NOT NULL DEFAULT '[]', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS spese (
      id TEXT PRIMARY KEY, descrizione TEXT NOT NULL DEFAULT '', importo REAL NOT NULL DEFAULT 0,
      iva REAL DEFAULT 0, categoria TEXT DEFAULT '', data_spesa TEXT NOT NULL,
      ricorrente INTEGER NOT NULL DEFAULT 0, ricorrenza TEXT DEFAULT '',
      periodo_riferimento TEXT DEFAULT '', data_inizio TEXT, data_fine TEXT,
      note TEXT DEFAULT '', user_id TEXT, deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS schede_clienti_da_confermare (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', cognome TEXT DEFAULT '',
      telefono TEXT DEFAULT '', email TEXT DEFAULT '', data_nascita TEXT,
      note TEXT DEFAULT '', stato TEXT NOT NULL DEFAULT 'in_attesa', user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS giorni_parrucchieri (
      id TEXT PRIMARY KEY, data_specifica TEXT NOT NULL, parrucchiere_id TEXT NOT NULL,
      ordine INTEGER NOT NULL DEFAULT 0, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS voci_extra_catalogo (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL DEFAULT '', prezzo REAL NOT NULL DEFAULT 0,
      attivo INTEGER NOT NULL DEFAULT 1, user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT, _dirty INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pending_deletes (
      id TEXT PRIMARY KEY, table_name TEXT NOT NULL, record_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pending_deletes_table ON pending_deletes(table_name);
    CREATE INDEX IF NOT EXISTS idx_appuntamenti_data ON appuntamenti(data_ora);
    CREATE INDEX IF NOT EXISTS idx_fiches_app ON fiches(appuntamento_id);
    CREATE INDEX IF NOT EXISTS idx_fiche_voci_fiche ON fiche_voci(fiche_id);
    CREATE INDEX IF NOT EXISTS idx_clienti_nome ON clienti(cognome, nome);
  `);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function applyFilters(whereParts, params, filters) {
  for (const f of (filters || [])) {
    if (f.op === 'is_null') { whereParts.push(`${f.col} IS NULL`); }
    else if (f.op === 'not_null') { whereParts.push(`${f.col} IS NOT NULL`); }
    else if (f.op === 'in') {
      if (!f.val || f.val.length === 0) { whereParts.push('1=0'); }
      else { whereParts.push(`${f.col} IN (${f.val.map(() => '?').join(',')})`); params.push(...f.val); }
    }
    else if (f.op === '=' || f.op === 'eq') { whereParts.push(`${f.col} = ?`); params.push(f.val); }
    else if (f.op === '!=' || f.op === 'neq') { whereParts.push(`${f.col} != ?`); params.push(f.val); }
    else if (f.op === '>=' || f.op === 'gte') { whereParts.push(`${f.col} >= ?`); params.push(f.val); }
    else if (f.op === '<=' || f.op === 'lte') { whereParts.push(`${f.col} <= ?`); params.push(f.val); }
    else if (f.op === '>') { whereParts.push(`${f.col} > ?`); params.push(f.val); }
    else if (f.op === '<') { whereParts.push(`${f.col} < ?`); params.push(f.val); }
    else if (f.op === 'like') { whereParts.push(`${f.col} LIKE ?`); params.push(f.val); }
  }
}

function dbSelect({ table, columns = '*', filters = [], orderBy = [], limit = null, countOnly = false }) {
  if (!db) return countOnly ? 0 : [];
  try {
    const wp = [], params = [];
    applyFilters(wp, params, filters);
    const where = wp.length ? ' WHERE ' + wp.join(' AND ') : '';
    if (countOnly) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}${where}`).get(...params);
      return row ? row.cnt : 0;
    }
    const order = orderBy.length ? ' ORDER BY ' + orderBy.map(o => `${o.col} ${o.asc !== false ? 'ASC' : 'DESC'}`).join(', ') : '';
    const lim = limit !== null ? ` LIMIT ${parseInt(limit)}` : '';
    return db.prepare(`SELECT ${columns} FROM ${table}${where}${order}${lim}`).all(...params);
  } catch (e) { console.error(`[DB] SELECT ${table}:`, e.message); return countOnly ? 0 : []; }
}

function coerce(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) { if (typeof out[k] === 'boolean') out[k] = out[k] ? 1 : 0; }
  return out;
}

function dbInsert({ table, data, userId }) {
  if (!db) return null;
  try {
    const id = data.id || generateId();
    const ts = nowIso();
    const row = coerce({ ...data, id, user_id: userId || data.user_id, created_at: data.created_at || ts, updated_at: ts, _dirty: 1 });
    const cols = Object.keys(row).filter(k => row[k] !== undefined);
    db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(k => row[k]));
    return dbSelect({ table, filters: [{ col: 'id', op: '=', val: id }] })[0] || null;
  } catch (e) { console.error(`[DB] INSERT ${table}:`, e.message); return null; }
}

function dbUpdate({ table, id, data }) {
  if (!db) return null;
  try {
    const updates = coerce({ ...data, updated_at: nowIso(), _dirty: 1 });
    const cols = Object.keys(updates).filter(k => k !== 'id' && updates[k] !== undefined);
    db.prepare(`UPDATE ${table} SET ${cols.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...cols.map(k => updates[k]), id);
    return dbSelect({ table, filters: [{ col: 'id', op: '=', val: id }] })[0] || null;
  } catch (e) { console.error(`[DB] UPDATE ${table}:`, e.message); return null; }
}

function dbDelete({ table, filters }) {
  if (!db) return false;
  try {
    const wp = [], params = [];
    applyFilters(wp, params, filters);
    // Track deleted IDs in pending_deletes so sync can push the deletion to Supabase
    try {
      const toDelete = db.prepare(`SELECT id FROM ${table} WHERE ${wp.join(' AND ')}`).all(...params);
      if (toDelete.length > 0) {
        const insertPending = db.prepare('INSERT OR IGNORE INTO pending_deletes (id, table_name, record_id, deleted_at) VALUES (?,?,?,?)');
        const ts = nowIso();
        for (const row of toDelete) {
          if (row.id) insertPending.run(generateId(), table, row.id, ts);
        }
      }
    } catch (e2) { console.warn('[DB] pending_deletes insert:', e2.message); }
    db.prepare(`DELETE FROM ${table} WHERE ${wp.join(' AND ')}`).run(...params);
    return true;
  } catch (e) { console.error(`[DB] DELETE ${table}:`, e.message); return false; }
}

function getPendingDeletes(table) {
  if (!db) return [];
  try { return db.prepare('SELECT * FROM pending_deletes WHERE table_name = ?').all(table); }
  catch { return []; }
}

function markDeletesSynced(ids) {
  if (!db || !ids || !ids.length) return;
  try {
    const ph = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM pending_deletes WHERE id IN (${ph})`).run(...ids);
  } catch (e) { console.error('[DB] markDeletesSynced:', e.message); }
}

function dbUpsert({ table, data, onConflict, userId }) {
  if (!db) return null;
  try {
    const existing = (() => {
      if (!onConflict) return null;
      const filters = onConflict.split(',').map(c => c.trim()).map(col => ({ col, op: '=', val: data[col] })).filter(f => f.val !== undefined && f.val !== null);
      if (!filters.length) return null;
      const rows = dbSelect({ table, filters });
      return rows.length > 0 ? rows[0] : null;
    })();
    if (existing) return dbUpdate({ table, id: existing.id, data });
    return dbInsert({ table, data: { ...data, id: data.id || generateId() }, userId });
  } catch (e) { console.error(`[DB] UPSERT ${table}:`, e.message); return null; }
}

function dbSyncUpsert({ table, rows }) {
  if (!db || !rows || rows.length === 0) return;
  const ts = nowIso();
  const upsertAll = db.transaction((allRows) => {
    for (const row of allRows) {
      // Non sovrascrivere righe con modifiche locali non ancora sincronizzate
      try {
        const local = db.prepare(`SELECT _dirty FROM ${table} WHERE id = ?`).get(row.id);
        if (local && local._dirty === 1) continue;
      } catch { /* tabella senza _dirty: prosegui */ }
      const r = coerce({ ...row, synced_at: ts, _dirty: 0 });
      const cols = Object.keys(r).filter(k => r[k] !== undefined);
      db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(k => r[k]));
    }
  });
  upsertAll(rows);
}

function getDirtyRows(table) {
  if (!db) return [];
  try { return db.prepare(`SELECT * FROM ${table} WHERE _dirty = 1`).all(); }
  catch { return []; }
}

function markSynced(table, ids) {
  if (!db || !ids.length) return;
  const ph = ids.map(() => '?').join(',');
  db.prepare(`UPDATE ${table} SET _dirty = 0, synced_at = ? WHERE id IN (${ph})`).run(nowIso(), ...ids);
}

function markAllDirty(table) {
  if (!db) return 0;
  try {
    return db.prepare(`UPDATE ${table} SET _dirty = 1`).run().changes;
  } catch { return 0; }
}

const ALL_TABLES = [
  'clienti','parrucchieri','trattamenti_catalogo','appuntamenti','appuntamento_trattamenti',
  'schede_colore','fiches','fiche_voci','incassi_giornalieri','carte_sconto','utilizzi_carta_sconto',
  'carte_premium','ricariche_carta_premium','utilizzi_carta_premium','prodotti_rivendita_catalogo',
  'rivendita_prodotti','trattamenti_eseguiti','impostazioni','template_messaggi_carta_sconto',
  'template_messaggi_comunicazioni','assenze_parrucchieri','magazzino_prodotti','magazzino_categorie',
  'magazzino_schede_salvate','spese','giorni_parrucchieri','voci_extra_catalogo','gift_pass','mappa_bellezza',
];

function exportLocalData() {
  if (!db) return null;
  const out = {};
  for (const t of ALL_TABLES) {
    try { out[t] = db.prepare(`SELECT * FROM ${t}`).all(); }
    catch { out[t] = []; }
  }
  return out;
}

function importBackup(backupData) {
  if (!db) return { success: false, error: 'DB non disponibile' };
  const results = {};
  const doImport = db.transaction(() => {
    for (const table of ALL_TABLES) {
      const rows = backupData[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      try { dbSyncUpsert({ table, rows }); results[table] = { ok: true, count: rows.length }; }
      catch (e) { results[table] = { ok: false, error: String(e) }; }
    }
  });
  try { doImport(); return { success: true, results }; }
  catch (e) { return { success: false, error: String(e), results }; }
}

// ─── Finestra principale ──────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

function createTray() {
  const appPath = app.getAppPath();
  const iconPath = join(appPath, 'dist', 'icons', 'icon-96x96.png');
  const fallbackPath = join(appPath, 'dist', 'icons', 'icon-192x192.png');
  const img = nativeImage.createFromPath(existsSync(iconPath) ? iconPath : existsSync(fallbackPath) ? fallbackPath : '');
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('Gestionale Salone');
  const menu = Menu.buildFromTemplate([
    { label: 'Apri Gestionale Salone', click() { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } } },
    { type: 'separator' },
    { label: 'Esci', click() { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } });
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'Gestionale Salone',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    autoHideMenuBar: true,
  });
  mainWindow.setMenu(null);
  if (isDev) { mainWindow.loadURL('http://localhost:5173'); }
  else { mainWindow.loadFile(join(app.getAppPath(), 'dist', 'index.html')); }
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('before-input-event', (_e, input) => { if (input.key === 'F12') mainWindow.webContents.toggleDevTools(); });
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingDeepLink) { mainWindow.webContents.send('deep-link', pendingDeepLink); pendingDeepLink = null; }
    mainWindow.webContents.send('db:ready', dbReady);
  });
}

app.whenReady().then(() => {
  const deepLinkArg = process.argv.find(a => a.startsWith(`${PROTOCOL}://`));
  if (deepLinkArg) pendingDeepLink = deepLinkArg;
  dbReady = initDatabase();
  createWindow();
  createTray();
  startBackupScheduler();
  startFichesScheduler();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin' && isQuitting) app.quit(); });
app.on('before-quit', () => { isQuitting = true; });

// ─── Scheduler backup automatico ─────────────────────────────────────────────
let schedulerInterval = null;
let backupSchedPending = false;

function startBackupScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  checkAndRunBackup();
  schedulerInterval = setInterval(checkAndRunBackup, 60_000);
}

async function checkAndRunBackup() {
  if (backupSchedPending) return;
  const cfg = readConfig();
  if (!cfg.enabled) return;
  const n = new Date();
  const todayStr = toLocalDateStr(n);
  if (cfg.last === todayStr) return;
  const [hh, mm] = cfg.time.split(':').map(Number);
  const timePassed = n.getHours() > hh || (n.getHours() === hh && n.getMinutes() >= mm);
  if (!timePassed) return;

  // Catch-up: if last < yesterday, backup yesterday first (only last missing day)
  const yesterday = new Date(n);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  let targetDate;
  if (cfg.last < yesterdayStr) {
    targetDate = yesterdayStr;
  } else {
    if (!cfg.days.includes(n.getDay())) return;
    targetDate = todayStr;
  }

  backupSchedPending = true;
  if (mainWindow) mainWindow.webContents.send('trigger-auto-backup', { todayStr: targetDate });
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Scheduler auto-salvataggio fiches ───────────────────────────────────────
let fichesSchedInterval = null;
let fichesSchedPending = false;

function startFichesScheduler() {
  if (fichesSchedInterval) clearInterval(fichesSchedInterval);
  checkAndRunFiches();
  fichesSchedInterval = setInterval(checkAndRunFiches, 60_000);
}

function checkAndRunFiches() {
  if (fichesSchedPending) return;
  const cfg = readFichesSched();
  if (!cfg.enabled) return;
  const n = new Date();
  const todayStr = toLocalDateStr(n);
  const [hh, mm] = cfg.time.split(':').map(Number);
  const todayTimePassed = n.getHours() > hh || (n.getHours() === hh && n.getMinutes() >= mm);
  const allowedDays = cfg.days || [1, 2, 3, 4, 5];

  // Collect all missing dates from (last+1) up to today
  let cursor;
  if (cfg.last) {
    cursor = new Date(cfg.last + 'T12:00:00');
    cursor.setDate(cursor.getDate() + 1);
  } else {
    cursor = new Date(todayStr + 'T12:00:00');
  }

  const dates = [];
  while (true) {
    const dateStr = toLocalDateStr(cursor);
    if (dateStr > todayStr) break;
    if (dateStr === todayStr) {
      // Include today only if scheduled time has passed and day is allowed
      if (todayTimePassed && allowedDays.includes(cursor.getDay())) dates.push(dateStr);
      break;
    } else {
      // Past dates: always include (catch-up, regardless of allowed days)
      dates.push(dateStr);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) return;
  const latestDate = dates[dates.length - 1];
  fichesSchedPending = true;
  if (mainWindow) mainWindow.webContents.send('trigger-auto-fiches', { dates, latestDate });
}

// ─── IPC: backup file ─────────────────────────────────────────────────────────
ipcMain.handle('backup:get-config', () => readConfig());
ipcMain.handle('backup:set-config', (_e, cfg) => { writeConfig(cfg); startBackupScheduler(); return { ok: true }; });
ipcMain.handle('backup:pick-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: 'Scegli cartella backup', properties: ['openDirectory', 'createDirectory'] });
  return canceled || !filePaths.length ? { ok: false } : { ok: true, folder: filePaths[0] };
});
ipcMain.handle('backup:save-auto', async (_e, { filename, content }) => {
  const cfg = readConfig();
  if (!cfg.folder) return { ok: false, reason: 'no-folder' };
  try { writeFileSync(join(cfg.folder, filename), content, 'utf8'); return { ok: true, filePath: join(cfg.folder, filename) }; }
  catch (err) { return { ok: false, reason: String(err) }; }
});
ipcMain.handle('backup:save-file', async (_e, { filename, content }) => {
  const cfg = readConfig();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(cfg.folder || app.getPath('documents'), filename),
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, reason: 'canceled' };
  try { writeFileSync(filePath, content, 'utf8'); return { ok: true, filePath }; }
  catch (err) { return { ok: false, reason: String(err) }; }
});
ipcMain.handle('backup:mark-done', (_e, { todayStr }) => { backupSchedPending = false; const cfg = readConfig(); cfg.last = todayStr; writeConfig(cfg); return { ok: true }; });
ipcMain.handle('shell:show-folder', (_e, fp) => shell.openPath(fp));
ipcMain.handle('shell:show-item', (_e, fp) => shell.showItemInFolder(fp));
ipcMain.handle('shell:open-external', (_e, url) => shell.openExternal(url));

// ─── IPC: cartelle di salvataggio ────────────────────────────────────────────
ipcMain.handle('files:get-paths', () => readSavePaths());
ipcMain.handle('files:set-paths', (_e, paths) => { writeSavePaths(paths); return { ok: true }; });
ipcMain.handle('files:pick-folder', async (_e, { label }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: label || 'Scegli cartella', properties: ['openDirectory', 'createDirectory'] });
  return canceled || !filePaths.length ? { ok: false } : { ok: true, folder: filePaths[0] };
});
ipcMain.handle('files:save-auto', async (_e, { type, filename, content, encoding }) => {
  const paths = readSavePaths();
  const folder = paths[type];
  if (!folder) return { ok: false, reason: 'no-folder' };
  try {
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
    const fullPath = join(folder, filename);
    if (encoding === 'base64') {
      writeFileSync(fullPath, Buffer.from(content, 'base64'));
    } else {
      writeFileSync(fullPath, content, 'utf8');
    }
    return { ok: true, filePath: fullPath };
  } catch (err) { return { ok: false, reason: String(err) }; }
});

// ─── IPC: scheduler fiches ───────────────────────────────────────────────────
ipcMain.handle('fiches:get-sched', () => readFichesSched());
ipcMain.handle('fiches:set-sched', (_e, cfg) => { writeFichesSched(cfg); startFichesScheduler(); return { ok: true }; });
ipcMain.handle('fiches:mark-done', (_e, { todayStr }) => { fichesSchedPending = false; const cfg = readFichesSched(); cfg.last = todayStr; writeFichesSched(cfg); return { ok: true }; });

// ─── IPC: database locale ─────────────────────────────────────────────────────
ipcMain.handle('db:is-ready', () => dbReady);

ipcMain.handle('db:select', (_e, args) => {
  try { return { ok: true, data: dbSelect(args) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:insert', (_e, args) => {
  try { return { ok: true, data: dbInsert(args) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:update', (_e, args) => {
  try { return { ok: true, data: dbUpdate(args) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:delete', (_e, args) => {
  try { return { ok: true, data: dbDelete(args) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:upsert', (_e, args) => {
  try { return { ok: true, data: dbUpsert(args) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:bulk-insert', (_e, { table, rows, userId }) => {
  if (!db || !rows || rows.length === 0) return { ok: true, count: 0 };
  try {
    const insertAll = db.transaction((allRows) => { for (const row of allRows) dbInsert({ table, data: row, userId }); return allRows.length; });
    return { ok: true, count: insertAll(rows) };
  } catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:sync-upsert', (_e, { table, rows }) => {
  try { dbSyncUpsert({ table, rows }); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:get-dirty', (_e, { table }) => {
  try { return { ok: true, data: getDirtyRows(table) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:mark-synced', (_e, { table, ids }) => {
  try { markSynced(table, ids); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:mark-all-dirty', (_e, { table }) => {
  try { return { ok: true, changes: markAllDirty(table) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:get-pending-deletes', (_e, { table }) => {
  try { return { ok: true, data: getPendingDeletes(table) }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:mark-deletes-synced', (_e, { ids }) => {
  try { markDeletesSynced(ids); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:export', () => {
  try { return { ok: true, data: exportLocalData() }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:import-backup', (_e, backupData) => {
  try { return importBackup(backupData); }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('db:get-path', () => {
  const dbPath = join(USER_DATA, 'database', 'gestionale.db');
  return { path: dbPath, exists: existsSync(dbPath) };
});
ipcMain.handle('db:set-user-profile', (_e, { userId }) => {
  try {
    const ok = openDatabase(userId);
    dbReady = ok;
    if (mainWindow) mainWindow.webContents.send('db:ready', ok);
    return { ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: autenticazione locale offline ───────────────────────────────────────
ipcMain.handle('auth:save-profile', (_e, { userId, email, password }) => {
  try {
    const profiles = readLocalProfiles();
    const salt = randomBytes(32).toString('hex');
    const hash = hashPassword(password, salt);

    // Migrazione local UUID → Supabase UUID:
    // se esiste un profilo con la stessa email ma un userId diverso,
    // rinomina la cartella SQLite e aggiorna user_id in tutte le tabelle.
    const oldProfile = profiles.find(
      p => p.email.toLowerCase() === email.toLowerCase() && p.userId !== userId
    );
    if (oldProfile) {
      const migrated = migrateLocalDatabase(oldProfile.userId, userId);
      if (migrated) {
        console.log('[Auth] Migrazione completata:', oldProfile.userId, '→', userId);
        // Riapri il DB sulla nuova cartella migrata in modo che le query successive
        // usino i dati corretti senza aspettare un altro setUserProfile dal renderer.
        const ok = openDatabase(userId);
        dbReady = ok;
        if (mainWindow) mainWindow.webContents.send('db:ready', ok);
        // Rimuovi il vecchio profilo dall'elenco
        const filtered = profiles.filter(p => p.userId !== oldProfile.userId);
        filtered.push({ userId, email, hash, salt, savedAt: new Date().toISOString() });
        writeLocalProfiles(filtered);
        return { ok: true, migrated: true };
      }
    }

    const idx = profiles.findIndex(p => p.userId === userId);
    const profile = { userId, email, hash, salt, savedAt: new Date().toISOString() };
    if (idx >= 0) profiles[idx] = profile; else profiles.push(profile);
    writeLocalProfiles(profiles);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('auth:get-profiles', () => {
  return readLocalProfiles().map(p => ({ userId: p.userId, email: p.email, savedAt: p.savedAt }));
});

ipcMain.handle('auth:verify-password', (_e, { email, password }) => {
  try {
    const profiles = readLocalProfiles();
    const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (!profile) return { ok: false, error: 'Nessun profilo locale trovato per questa email.' };
    const hash = hashPassword(password, profile.salt);
    if (hash !== profile.hash) return { ok: false, error: 'Password non corretta.' };
    return { ok: true, userId: profile.userId, email: profile.email };
  } catch (e) { return { ok: false, error: String(e) }; }
});

// ─── IPC: Hardware ID per sistema licenze ─────────────────────────────────────

function getHardwareFingerprint() {
  try {
    const cpu = cpus()[0]?.model ?? 'unknown-cpu';
    const host = hostname();
    // Cerca il primo MAC address non loopback
    const nets = networkInterfaces();
    let mac = '';
    for (const iface of Object.values(nets)) {
      const entry = iface?.find(n => !n.internal && n.mac && n.mac !== '00:00:00:00:00:00');
      if (entry) { mac = entry.mac; break; }
    }
    const raw = `${cpu}|${host}|${mac}`;
    return createHash('sha256').update(raw).digest('hex').toUpperCase().substring(0, 16);
  } catch {
    // Fallback: usa una stringa derivata dall'hostname
    return createHash('sha256').update(hostname()).digest('hex').toUpperCase().substring(0, 16);
  }
}

ipcMain.handle('license:get-hardware-id', () => {
  return { hardwareId: getHardwareFingerprint() };
});

ipcMain.handle('license:get-cloud-request-id', () => {
  // Cloud Request ID = variante dell'hardware ID con salt diverso
  const base = getHardwareFingerprint();
  const cloudId = createHash('sha256').update(base + 'CLOUD').digest('hex').toUpperCase().substring(0, 16);
  return { cloudRequestId: cloudId };
});

// Genera OTP locale da hardware ID (stessa logica del renderer per verifica offline)
ipcMain.handle('license:generate-local-otp', (_e, { hardwareId }) => {
  const MASTER_SALT = 'MioBrandEsclusivoPass2026';
  const hash = createHash('sha256').update(hardwareId + MASTER_SALT).digest('hex').toUpperCase();
  const otp = hash.substring(0, 4) + '-' + hash.substring(4, 8);
  return { otp };
});

// Genera OTP cloud da cloud request ID
ipcMain.handle('license:generate-cloud-otp', (_e, { cloudRequestId }) => {
  const CLOUD_SALT = 'CloudActivationSalt2026';
  const hash = createHash('sha256').update(cloudRequestId + CLOUD_SALT).digest('hex').toUpperCase();
  const otp = hash.substring(0, 4) + '-' + hash.substring(4, 8);
  return { otp };
});
