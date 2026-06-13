/**
 * Sincronizzazione bidirezionale SQLite locale <-> Supabase.
 *
 * - syncSupabaseToLocal: scarica tutto da Supabase e aggiorna il SQLite locale
 * - syncLocalToSupabase: carica le righe con _dirty=1 e le scrive su Supabase
 * - pushRowNow: push immediato di una singola riga dopo una scrittura locale
 */

import { supabase } from './supabase';
import { isElectron, compressImage } from './localDb';
import { setTableCache, getTableCache } from './indexedDb';

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
  'impostazioni',
  'impostazioni_tasse',
  'template_messaggi_carta_sconto',
  'template_messaggi_comunicazioni',
  'assenze_parrucchieri',
  'magazzino_prodotti',
  'magazzino_schede_salvate',
  'spese',
  'giorni_parrucchieri',
  'voci_extra_catalogo',
  'gift_pass',
];

// ─── Helper: scarica URL immagine e restituisce data URI base64 ───────────────

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

// ─── Supabase -> IndexedDB (prefetch per uso offline senza SQLite) ────────────

export async function prefetchToIndexedDb(userId: string): Promise<void> {
  for (const table of SYNC_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);
      if (error) { console.warn(`[Prefetch] ${table}:`, error.message); continue; }
      await setTableCache(table, userId, data ?? []);
    } catch (e) {
      console.warn(`[Prefetch] Errore ${table}:`, e);
    }
  }
}

export async function getOfflineTableData(table: string, userId: string): Promise<unknown[]> {
  return (await getTableCache(table, userId)) ?? [];
}

// ─── Supabase -> SQLite (download completo) + IndexedDB ──────────────────────

export async function syncSupabaseToLocal(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  for (const table of SYNC_TABLES) {
    try {
      // Carica gli ID in attesa di cancellazione per non re-scaricarli da Supabase
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

      // Filtra le righe che sono pendenti di cancellazione locale
      const filteredData = pendingDeleteIds.size > 0
        ? (data as Record<string, unknown>[]).filter(r => !pendingDeleteIds.has(r.id as string))
        : (data as Record<string, unknown>[]);

      // Salva sempre in IndexedDB come fallback (solo righe filtrate)
      await setTableCache(table, userId, filteredData);

      if (filteredData.length === 0) continue;

      // Scarica immagini come base64 per uso offline
      const rows = await Promise.all(
        filteredData.map(async (row) => {
          if (table === 'clienti' && row.foto_url && typeof row.foto_url === 'string') {
            const b64 = await fetchImageAsBase64(row.foto_url);
            return { ...row, foto_base64: b64 };
          }
          if (table === 'schede_colore') {
            const updates: Record<string, unknown> = { ...row };
            if (row.foto_prima_url && typeof row.foto_prima_url === 'string') {
              updates.foto_prima_base64 = await fetchImageAsBase64(row.foto_prima_url as string);
            }
            if (row.foto_dopo_url && typeof row.foto_dopo_url === 'string') {
              updates.foto_dopo_base64 = await fetchImageAsBase64(row.foto_dopo_url as string);
            }
            return updates;
          }
          return row;
        })
      );

      await window.electronAPI.db.syncUpsert({ table, rows });
    } catch (e) {
      console.warn(`[Sync] Errore download ${table}:`, e);
    }
  }
}

// ─── SQLite -> Supabase (upload righe dirty) ──────────────────────────────────

export async function syncLocalToSupabase(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  // Prima: carica le foto che erano state salvate offline come pendenti
  await _uploadPendingPhotos(userId);

  for (const table of SYNC_TABLES) {
    try {
      const res = await window.electronAPI.db.getDirty(table);
      if (res.ok && res.data && (res.data as unknown[]).length > 0) {
        await _pushDirtyRows(table, res.data as Record<string, unknown>[], userId);
      }
    } catch (e) {
      console.warn(`[Sync] Errore upload ${table}:`, e);
    }

    // Propaga le cancellazioni pendenti a Supabase
    try {
      const pdRes = await window.electronAPI.db.getPendingDeletes(table);
      if (!pdRes.ok || !pdRes.data || (pdRes.data as unknown[]).length === 0) continue;
      const pending = pdRes.data as { id: string; record_id: string }[];
      const recordIds = pending.map(p => p.record_id);
      const { error } = await supabase.from(table).delete().in('id', recordIds);
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

// ─── Push immediato di una singola riga appena scritta ────────────────────────

/**
 * Chiamato subito dopo ogni INSERT/UPDATE/UPSERT in Electron.
 * Fire-and-forget: se fallisce, la riga resta dirty e viene ripresa dal sync periodico.
 */
export async function pushRowNow(
  table: string,
  row: Record<string, unknown>,
  userId: string
): Promise<void> {
  if (!isElectron() || !navigator.onLine) return;
  try {
    const { _dirty, synced_at, foto_base64, foto_prima_base64, foto_dopo_base64, foto_base64_pendente, ...rest } = row as Record<string, unknown>;
    void _dirty; void synced_at; void foto_base64; void foto_prima_base64; void foto_dopo_base64; void foto_base64_pendente;
    const rowToSync = { ...rest, user_id: userId };

    const { error } = await supabase
      .from(table)
      .upsert(rowToSync, { onConflict: 'id' });

    if (error) {
      console.warn(`[Sync] Push immediato ${table} fallito:`, error.message);
      return;
    }

    // Marca come sincronizzata
    if (row.id && window.electronAPI?.db) {
      await window.electronAPI.db.markSynced(table, [row.id as string]);
    }
  } catch (e) {
    console.warn(`[Sync] Push immediato ${table} errore:`, e);
  }
}

// ─── Upload foto pendenti ─────────────────────────────────────────────────────

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
        const { error: uploadErr } = await supabase.storage
          .from('foto-clienti')
          .upload(filename, compressed, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) { console.warn(`[Sync] Upload foto cliente ${row.id}:`, uploadErr.message); continue; }

        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
        const newUrl = urlData.publicUrl;
        await supabase.from('clienti').update({ foto_url: newUrl }).eq('id', row.id as string).eq('user_id', userId);
        await window.electronAPI.db.update({ table: 'clienti', id: row.id as string, data: { foto_url: newUrl, foto_base64_pendente: '' } });
        console.log(`[Sync] Foto cliente ${row.id} caricata`);
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
        const { error: uploadErr } = await supabase.storage
          .from('foto-clienti')
          .upload(filename, compressed, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) { console.warn(`[Sync] Upload foto prodotto ${row.id}:`, uploadErr.message); continue; }

        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
        const newUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('prodotti_rivendita_catalogo').update({ foto_url: newUrl }).eq('id', row.id as string).eq('user_id', userId);
        await window.electronAPI.db.update({ table: 'prodotti_rivendita_catalogo', id: row.id as string, data: { foto_url: newUrl, foto_base64_pendente: '' } });
        console.log(`[Sync] Foto prodotto ${row.id} caricata`);
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
      const { error: uploadErr } = await supabase.storage
        .from('foto-clienti')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      if (uploadErr) { console.warn('[Sync] Upload logo salone pendente:', uploadErr.message); return; }

      const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(path);
      const logoUrl = urlData.publicUrl + '?v=' + Date.now();
      await supabase.from('impostazioni').upsert({ chiave: 'logo_salone_url', valore: logoUrl, user_id: userId }, { onConflict: 'chiave,user_id' });
      await window.electronAPI.db.upsert({ table: 'impostazioni', data: { chiave: 'logo_salone_url', valore: logoUrl, user_id: userId }, onConflict: 'chiave,user_id', userId });
      await window.electronAPI.db.upsert({ table: 'impostazioni', data: { chiave: 'logo_salone_b64_pendente', valore: '', user_id: userId }, onConflict: 'chiave,user_id', userId });
      console.log('[Sync] Logo salone pendente caricato');
    } catch (e) { console.warn('[Sync] Errore upload logo salone pendente:', e); }
  } catch (e) { console.warn('[Sync] Errore lettura logo salone pendente:', e); }
}

// ─── Push di piu' righe dirty ─────────────────────────────────────────────────

async function _pushDirtyRows(
  table: string,
  dirtyRows: Record<string, unknown>[],
  userId: string
): Promise<void> {
  const rows = dirtyRows.map(row => {
    const { _dirty, synced_at, foto_base64, foto_prima_base64, foto_dopo_base64, foto_base64_pendente, ...rest } = row;
    void _dirty; void synced_at; void foto_base64; void foto_prima_base64; void foto_dopo_base64; void foto_base64_pendente;
    return { ...rest, user_id: userId };
  });

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.warn(`[Sync] Errore push ${table}:`, error.message);
    return;
  }

  const ids = rows.map(r => r.id as string).filter(Boolean);
  if (ids.length > 0 && window.electronAPI?.db) {
    await window.electronAPI.db.markSynced(table, ids);
  }
}
