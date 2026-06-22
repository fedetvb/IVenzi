/**
 * Sync engine unificato — Local-First, piattaforma-agnostico.
 *
 * Regola di conflitto: l'ultima modifica vince (Last-Write-Wins via updated_at ISO).
 *
 * Flusso:
 *   1. localToRemote  — invia le righe dirty (locale più recente)
 *   2. remoteToLocal  — scarica le righe remote più recenti del locale e le applica
 *
 * Piattaforme:
 *   - Electron  → SQLite locale (via window.electronAPI.db) + flag _dirty
 *   - Browser   → IndexedDB local_rows store + flag dirty
 */

import { supabase } from './supabase';
import { isElectron, compressImage } from './localDb';
import {
  setTableCache,
  getTableCache,
  localRowGetDirty,
  localRowGetAll,
  localRowMarkSynced,
  localRowApplyRemote,
  localRowBulkApplyRemote,
  localRowDelete,
  localRowUpsert,
} from './indexedDb';

// Tabelle soggette a sincronizzazione bidirezionale
const SYNC_TABLES: string[] = [
  'clienti',
  'parrucchieri',
  'trattamenti_catalogo',
  'appuntamenti',
  'appuntamento_trattamenti',
  'schede_colore',
  'fiches',
  'fiche_voci',
  'incassi_giornalieri',
  'carte_sconto',
  'utilizzi_carta_sconto',
  'carte_premium',
  'ricariche_carta_premium',
  'utilizzi_carta_premium',
  'prodotti_rivendita_catalogo',
  'rivendita_prodotti',
  'trattamenti_eseguiti',
  'impostazioni_tasse',
  'template_messaggi_carta_sconto',
  'template_messaggi_comunicazioni',
  'assenze_parrucchieri',
  'magazzino_prodotti',
  'magazzino_categorie',
  'magazzino_schede_salvate',
  'spese',
  'giorni_parrucchieri',
  'voci_extra_catalogo',
  'gift_pass',
  'mappa_bellezza',
];

// Colonna di conflitto per tabelle con UNIQUE constraint diversa da `id`
const TABLE_CONFLICT_COLS: Record<string, string> = {
  carte_premium: 'codice',
  carte_sconto: 'codice',
  fiches: 'id',
  giorni_parrucchieri: 'data_specifica,parrucchiere_id',
};

// Colonne interne che non vengono mai inviate a Supabase
const LOCAL_ONLY_COLS = new Set([
  '_dirty', 'synced_at',
  'foto_base64', 'foto_prima_base64', 'foto_dopo_base64', 'foto_base64_pendente',
]);

// Campi obsoleti da rimuovere per tabella (presenti in IndexedDB ma non nel DB remoto)
const TABLE_EXTRA_STRIP: Record<string, Set<string>> = {
  gift_pass: new Set(['attiva']),  // campo con A (scorretto) — 'attivo' con O resta intatto
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripLocalCols(row: Record<string, unknown>, table?: string): Record<string, unknown> {
  const extra = table ? (TABLE_EXTRA_STRIP[table] ?? null) : null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!LOCAL_ONLY_COLS.has(k) && !(extra?.has(k))) out[k] = v;
  }
  return out;
}

/** Confronto timestamp: true se a è più recente di b (o b è assente). */
function isNewer(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return a > b; // ISO strings are lexicographically comparable
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return '';
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) ?? '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ─── Prefetch → IndexedDB (PWA / browser offline bootstrap) ──────────────────

export async function prefetchToIndexedDb(userId: string): Promise<void> {
  for (const table of SYNC_TABLES) {
    try {
      // Recupera righe proprie + righe storiche con user_id NULL (dati pre-migrazione)
      const [ownRes, nullRes] = await Promise.all([
        supabase.from(table).select('*').eq('user_id', userId),
        supabase.from(table).select('*').is('user_id', null),
      ]);
      if (ownRes.error) { console.warn(`[Prefetch] ${table}:`, ownRes.error.message); continue; }

      const seen = new Set<string>();
      const rows: Record<string, unknown>[] = [];
      for (const r of (ownRes.data ?? []) as Record<string, unknown>[]) {
        if (r.id) { seen.add(r.id as string); rows.push(r); }
      }
      // Includi righe NULL solo se non gia' coperte da una riga propria con lo stesso id
      if (!nullRes.error && nullRes.data) {
        for (const r of nullRes.data as Record<string, unknown>[]) {
          if (r.id && !seen.has(r.id as string)) rows.push(r);
        }
      }

      await localRowBulkApplyRemote(table, userId, rows);
    } catch (e) {
      console.warn(`[Prefetch] Errore ${table}:`, e);
    }
  }
}

export async function getOfflineTableData(table: string, userId: string): Promise<unknown[]> {
  return (await getTableCache(table, userId)) ?? [];
}

// ─── ELECTRON: Supabase → SQLite (download con confronto timestamp) ───────────

export async function syncSupabaseToLocal(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  for (const table of SYNC_TABLES) {
    try {
      const pdRes = await window.electronAPI.db.getPendingDeletes(table);
      const pendingDeleteIds = new Set<string>(
        ((pdRes.ok && pdRes.data as unknown[]) || []).map((p: unknown) => (p as { record_id: string }).record_id)
      );

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) {
        if (error) console.warn(`[Sync] Errore lettura ${table}:`, error.message);
        continue;
      }

      const remoteRows = (data as Record<string, unknown>[])
        .filter(r => !pendingDeleteIds.has(r.id as string));

      // Salva in IndexedDB come fallback PWA
      await setTableCache(table, userId, remoteRows);

      if (remoteRows.length === 0) continue;

      // Risoluzione conflitti timestamp-based:
      // recupera le righe dirty locali e crea una mappa id → updated_at
      const dirtyRes = await window.electronAPI.db.getDirty(table);
      const dirtyMap = new Map<string, string>();
      if (dirtyRes.ok && dirtyRes.data) {
        for (const r of dirtyRes.data as Record<string, unknown>[]) {
          if (r.id && r.updated_at) dirtyMap.set(r.id as string, r.updated_at as string);
        }
      }

      // Non sovrascrivere righe locali più recenti di quelle remote
      const rowsToApply = remoteRows.filter(r => {
        const localTs = dirtyMap.get(r.id as string);
        if (!localTs) return true;
        return !isNewer(localTs, r.updated_at as string);
      });

      if (rowsToApply.length === 0) continue;

      // Arricchisci immagini per uso offline
      const enriched = await Promise.all(
        rowsToApply.map(async (row) => {
          if (table === 'clienti' && row.foto_url && typeof row.foto_url === 'string') {
            return { ...row, foto_base64: await fetchImageAsBase64(row.foto_url) };
          }
          if (table === 'schede_colore') {
            const updates: Record<string, unknown> = { ...row };
            if (row.foto_prima_url) updates.foto_prima_base64 = await fetchImageAsBase64(row.foto_prima_url as string);
            if (row.foto_dopo_url) updates.foto_dopo_base64 = await fetchImageAsBase64(row.foto_dopo_url as string);
            return updates;
          }
          return row;
        })
      );

      await window.electronAPI.db.syncUpsert({ table, rows: enriched });
    } catch (e) {
      console.warn(`[Sync] Errore download ${table}:`, e);
    }
  }
}

// ─── ELECTRON: SQLite → Supabase (upload righe dirty con timestamp-check) ─────

export async function syncLocalToSupabase(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  // Prima: carica le foto pendenti offline
  await _uploadPendingPhotos(userId);

  for (const table of SYNC_TABLES) {
    // Upload righe dirty
    try {
      const res = await window.electronAPI.db.getDirty(table);
      if (res.ok && res.data && (res.data as unknown[]).length > 0) {
        await _pushDirtyRowsElectron(table, res.data as Record<string, unknown>[], userId);
      }
    } catch (e) {
      console.warn(`[Sync] Errore upload ${table}:`, e);
    }

    // Propaga cancellazioni pendenti
    try {
      const pdRes = await window.electronAPI.db.getPendingDeletes(table);
      if (!pdRes.ok || !pdRes.data || (pdRes.data as unknown[]).length === 0) continue;
      const pending = pdRes.data as { id: string; record_id: string }[];
      const { error } = await supabase.from(table).delete().in('id', pending.map(p => p.record_id));
      if (!error) {
        await window.electronAPI.db.markDeletesSynced(pending.map(p => p.id));
      } else {
        console.warn(`[Sync] Errore push deletes ${table}:`, error.message);
      }
    } catch (e) {
      console.warn(`[Sync] Errore upload deletes ${table}:`, e);
    }
  }
}

// ─── BROWSER: IndexedDB → Supabase (upload righe dirty con timestamp-check) ───

export async function syncBrowserToSupabase(userId: string): Promise<void> {
  if (isElectron()) return;

  for (const table of SYNC_TABLES) {
    try {
      const dirtyRows = await localRowGetDirty(table, userId);
      if (dirtyRows.length === 0) continue;

      for (const entry of dirtyRows) {
        try {
          if (entry.deleted) {
            const { error } = await supabase.from(table).delete().eq('id', entry.id);
            if (!error) await localRowMarkSynced(table, userId, entry.id);
            else console.warn(`[Sync Browser] Delete ${table} id=${entry.id}:`, error.message);
          } else {
            // Controlla il timestamp remoto: se il server è più recente, non sovrascrivere
            const { data: remote } = await supabase
              .from(table)
              .select('id, updated_at')
              .eq('id', entry.id)
              .maybeSingle();

            const remoteTs = (remote as Record<string, unknown> | null)?.updated_at as string | undefined;
            if (isNewer(remoteTs, entry.updated_at)) {
              const { data: fullRemote } = await supabase.from(table).select('*').eq('id', entry.id).maybeSingle();
              if (fullRemote) await localRowApplyRemote(table, userId, fullRemote as Record<string, unknown>);
              continue;
            }

            const rowToSync = { ...stripLocalCols(entry.data, table), user_id: userId, updated_at: entry.updated_at };
            const conflictCol = TABLE_CONFLICT_COLS[table] ?? 'id';
            const { error } = await supabase.from(table).upsert(rowToSync, { onConflict: conflictCol });
            if (!error) {
              await localRowMarkSynced(table, userId, entry.id);
            } else {
              console.warn(`[Sync Browser] Upsert ${table} id=${entry.id}:`, error.message);
            }
          }
        } catch (e) {
          console.warn(`[Sync Browser] Errore riga ${table} id=${entry.id}:`, e);
        }
      }
    } catch (e) {
      console.warn(`[Sync Browser] Errore tabella ${table}:`, e);
    }
  }
}

// ─── BROWSER: Supabase → IndexedDB (download con timestamp-check) ─────────────

export async function syncSupabaseToBrowser(userId: string): Promise<void> {
  if (isElectron()) return;

  for (const table of SYNC_TABLES) {
    try {
      const [ownRes, nullRes] = await Promise.all([
        supabase.from(table).select('*').eq('user_id', userId),
        supabase.from(table).select('*').is('user_id', null),
      ]);

      if (ownRes.error) {
        console.warn(`[Sync Browser] Errore lettura ${table}:`, ownRes.error.message);
        continue;
      }

      const seen = new Set<string>();
      const remoteRows: Record<string, unknown>[] = [];
      for (const r of (ownRes.data ?? []) as Record<string, unknown>[]) {
        if (r.id) { seen.add(r.id as string); remoteRows.push(r); }
      }
      if (!nullRes.error && nullRes.data) {
        for (const r of nullRes.data as Record<string, unknown>[]) {
          if (r.id && !seen.has(r.id as string)) remoteRows.push(r);
        }
      }

      if (remoteRows.length === 0) continue;

      const localRows = await localRowGetAll(table, userId);
      const localMap = new Map(localRows.map(r => [r.id, r]));

      for (const remoteRow of remoteRows) {
        const localEntry = localMap.get(remoteRow.id as string);
        if (!localEntry) {
          await localRowApplyRemote(table, userId, remoteRow);
        } else if (localEntry.dirty === 1) {
          continue;
        } else if (isNewer(remoteRow.updated_at as string, localEntry.updated_at)) {
          await localRowApplyRemote(table, userId, remoteRow);
        }
      }

      const updatedLocalRows = await localRowGetAll(table, userId);
      await setTableCache(table, userId, updatedLocalRows.filter(r => !r.deleted).map(r => r.data));

    } catch (e) {
      console.warn(`[Sync Browser] Errore download ${table}:`, e);
    }
  }
}

// ─── Entry point unificati (chiamati da App.tsx) ──────────────────────────────

export async function syncLocalToRemote(userId: string): Promise<void> {
  if (isElectron()) {
    await syncLocalToSupabase(userId);
  } else {
    await syncBrowserToSupabase(userId);
  }
}

export async function syncRemoteToLocal(userId: string): Promise<void> {
  if (isElectron()) {
    await syncSupabaseToLocal(userId);
  } else {
    await syncSupabaseToBrowser(userId);
  }
}

// ─── Push immediato di una singola riga (fire-and-forget) ────────────────────

export async function pushRowNow(
  table: string,
  row: Record<string, unknown>,
  userId: string
): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const rowToSync = { ...stripLocalCols(row, table), user_id: userId };

    // Timestamp-check: non sovrascrivere se Supabase ha una versione più recente
    if (row.updated_at && row.id) {
      const { data: remote } = await supabase
        .from(table)
        .select('id, updated_at')
        .eq('id', row.id as string)
        .maybeSingle();
      const remoteTs = (remote as Record<string, unknown> | null)?.updated_at as string | undefined;
      if (isNewer(remoteTs, row.updated_at as string)) {
        const { data: fullRemote } = await supabase.from(table).select('*').eq('id', row.id as string).maybeSingle();
        if (fullRemote) {
          if (isElectron() && window.electronAPI?.db) {
            await window.electronAPI.db.syncUpsert({ table, rows: [fullRemote] });
          } else if (!isElectron()) {
            await localRowApplyRemote(table, userId, fullRemote as Record<string, unknown>);
          }
        }
        return;
      }
    }

    const { error } = await supabase.from(table).upsert(rowToSync, { onConflict: 'id' });

    if (error) {
      console.warn(`[Sync] Push immediato ${table} fallito:`, error.message);
      return;
    }

    if (row.id) {
      if (isElectron() && window.electronAPI?.db) {
        await window.electronAPI.db.markSynced(table, [row.id as string]);
      } else if (!isElectron()) {
        await localRowMarkSynced(table, userId, row.id as string);
      }
    }
  } catch (e) {
    console.warn(`[Sync] Push immediato ${table} errore:`, e);
  }
}

// ─── Scrittura locale browser con dirty flag (chiamata da localDb.ts) ─────────

export async function browserLocalWrite(
  table: string,
  userId: string,
  rowData: Record<string, unknown>
): Promise<void> {
  if (isElectron()) return;
  if (!rowData.id) return;
  const row = { ...rowData, updated_at: rowData.updated_at ?? new Date().toISOString() };
  await localRowUpsert(table, userId, row, 1);
}

export async function browserLocalDelete(table: string, userId: string, id: string): Promise<void> {
  if (isElectron()) return;
  await localRowDelete(table, userId, id);
}

// ─── Upload foto pendenti (Electron) ─────────────────────────────────────────

async function _uploadPendingPhotos(userId: string): Promise<void> {
  if (!window.electronAPI?.db) return;
  await _uploadPendingClientPhotos(userId);
  await _uploadPendingProductPhotos(userId);
  await _uploadPendingLogoSalone(userId);
}

async function _uploadPendingClientPhotos(userId: string): Promise<void> {
  if (!window.electronAPI?.db) return;
  try {
    const res = await window.electronAPI.db.select({
      table: 'clienti',
      filters: [{ col: 'foto_base64_pendente', op: 'not_null' }],
    });
    if (!res.ok || !res.data) return;
    const rows = (res.data as Record<string, unknown>[]).filter(
      r => r.user_id === userId && r.foto_base64_pendente && typeof r.foto_base64_pendente === 'string' && (r.foto_base64_pendente as string).length > 0
    );
    for (const row of rows) {
      try {
        const compressed = await compressImage(row.foto_base64_pendente as string);
        const filename = `clienti/${row.id}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('foto-clienti').upload(filename, compressed, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) { console.warn(`[Sync] Upload foto cliente ${row.id}:`, uploadErr.message); continue; }
        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
        await supabase.from('clienti').update({ foto_url: urlData.publicUrl }).eq('id', row.id as string).eq('user_id', userId);
        await window.electronAPI.db.update({ table: 'clienti', id: row.id as string, data: { foto_url: urlData.publicUrl, foto_base64_pendente: '' } });
      } catch (e) { console.warn(`[Sync] Errore upload foto cliente ${row.id}:`, e); }
    }
  } catch (e) { console.warn('[Sync] Errore lettura foto clienti pendenti:', e); }
}

async function _uploadPendingProductPhotos(userId: string): Promise<void> {
  if (!window.electronAPI?.db) return;
  try {
    const res = await window.electronAPI.db.select({
      table: 'prodotti_rivendita_catalogo',
      filters: [{ col: 'foto_base64_pendente', op: 'not_null' }],
    });
    if (!res.ok || !res.data) return;
    const rows = (res.data as Record<string, unknown>[]).filter(
      r => r.user_id === userId && r.foto_base64_pendente && typeof r.foto_base64_pendente === 'string' && (r.foto_base64_pendente as string).length > 0
    );
    for (const row of rows) {
      try {
        const compressed = await compressImage(row.foto_base64_pendente as string);
        const filename = `prodotti/${userId}/${row.id}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('foto-clienti').upload(filename, compressed, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) { console.warn(`[Sync] Upload foto prodotto ${row.id}:`, uploadErr.message); continue; }
        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
        const newUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('prodotti_rivendita_catalogo').update({ foto_url: newUrl }).eq('id', row.id as string).eq('user_id', userId);
        await window.electronAPI.db.update({ table: 'prodotti_rivendita_catalogo', id: row.id as string, data: { foto_url: newUrl, foto_base64_pendente: '' } });
      } catch (e) { console.warn(`[Sync] Errore upload foto prodotto ${row.id}:`, e); }
    }
  } catch (e) { console.warn('[Sync] Errore lettura foto prodotti pendenti:', e); }
}

async function _uploadPendingLogoSalone(userId: string): Promise<void> {
  if (!window.electronAPI?.db) return;
  try {
    const res = await window.electronAPI.db.select({
      table: 'impostazioni',
      filters: [
        { col: 'chiave', op: 'eq', val: 'logo_salone_b64_pendente' },
        { col: 'user_id', op: 'eq', val: userId },
      ],
    });
    if (!res.ok || !res.data || (res.data as Record<string, unknown>[]).length === 0) return;
    const record = (res.data as Record<string, unknown>[])[0];
    const b64 = record.valore as string;
    if (!b64 || b64.length === 0) return;
    try {
      const compressed = await compressImage(b64);
      const path = `logo/${userId}/salone-logo.jpg`;
      const { error: uploadErr } = await supabase.storage.from('foto-clienti').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      if (uploadErr) { console.warn('[Sync] Upload logo salone pendente:', uploadErr.message); return; }
      const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(path);
      const logoUrl = urlData.publicUrl + '?v=' + Date.now();
      await supabase.from('impostazioni').upsert({ chiave: 'logo_salone_url', valore: logoUrl, user_id: userId }, { onConflict: 'chiave,user_id' });
      await window.electronAPI.db.upsert({ table: 'impostazioni', data: { chiave: 'logo_salone_url', valore: logoUrl, user_id: userId }, onConflict: 'chiave,user_id', userId });
      await window.electronAPI.db.upsert({ table: 'impostazioni', data: { chiave: 'logo_salone_b64_pendente', valore: '', user_id: userId }, onConflict: 'chiave,user_id', userId });
    } catch (e) { console.warn('[Sync] Errore upload logo salone pendente:', e); }
  } catch (e) { console.warn('[Sync] Errore lettura logo salone pendente:', e); }
}

// ─── Push di più righe dirty (Electron, con timestamp-check bulk) ─────────────

async function _pushDirtyRowsElectron(
  table: string,
  dirtyRows: Record<string, unknown>[],
  userId: string
): Promise<void> {
  const rows = dirtyRows.map(row => ({ ...stripLocalCols(row, table), user_id: userId }));
  const ids = rows.map(r => r.id as string).filter(Boolean);

  // Timestamp-check bulk
  const remoteMap = new Map<string, string>();
  try {
    const { data: remoteCheck } = await supabase
      .from(table)
      .select('id, updated_at')
      .in('id', ids);
    if (remoteCheck) {
      for (const r of remoteCheck as Record<string, unknown>[]) {
        if (r.id && r.updated_at) remoteMap.set(r.id as string, r.updated_at as string);
      }
    }
  } catch { /* ignora */ }

  const toUpsert: Record<string, unknown>[] = [];
  const toUpdateLocal: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const localTs = dirtyRows[i].updated_at as string | undefined;
    const remoteTs = remoteMap.get(rows[i].id as string);
    if (isNewer(remoteTs, localTs)) {
      toUpdateLocal.push(rows[i].id as string);
    } else {
      toUpsert.push(rows[i]);
    }
  }

  if (toUpsert.length > 0) {
    const conflictCol = TABLE_CONFLICT_COLS[table] ?? 'id';
    const { error } = await supabase.from(table).upsert(toUpsert, { onConflict: conflictCol });
    if (error) {
      console.warn(`[Sync] Errore push ${table}:`, error.message);
    } else {
      const syncedIds = toUpsert.map(r => r.id as string).filter(Boolean);
      if (syncedIds.length > 0 && window.electronAPI?.db) {
        await window.electronAPI.db.markSynced(table, syncedIds);
      }
    }
  }

  if (toUpdateLocal.length > 0 && window.electronAPI?.db) {
    try {
      const { data: freshRows } = await supabase.from(table).select('*').in('id', toUpdateLocal);
      if (freshRows && freshRows.length > 0) {
        await window.electronAPI.db.syncUpsert({ table, rows: freshRows });
      }
    } catch { /* best-effort */ }
  }
}

/**
 * Force-upload completo: marca dirty tutte le righe locali (Electron o browser),
 * poi esegue la sync verso Supabase. Usato dal pulsante "Sincronizza ora".
 * Restituisce il totale di righe marcate dirty.
 */
export async function syncForceAll(userId: string): Promise<number> {
  let total = 0;

  if (isElectron() && window.electronAPI?.db) {
    // Electron: marca dirty tutte le tabelle in SQLite
    for (const table of SYNC_TABLES) {
      try {
        const res = await window.electronAPI.db.markAllDirty(table);
        if (res?.ok) total += res.changes ?? 0;
      } catch { /* non bloccante */ }
    }
    await syncLocalToSupabase(userId);
  } else {
    // Browser: marca dirty tutte le righe in IndexedDB
    const { markAllRowsDirty } = await import('./indexedDb');
    total = await markAllRowsDirty(userId);
    await syncBrowserToSupabase(userId);
  }

  return total;
}
