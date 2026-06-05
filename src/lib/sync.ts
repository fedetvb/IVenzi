/**
 * Sincronizzazione bidirezionale SQLite locale <-> Supabase.
 *
 * - syncSupabaseToLocal: scarica tutto da Supabase e aggiorna il SQLite locale
 * - syncLocalToSupabase: carica le righe con _dirty=1 e le scrive su Supabase
 * - pushRowNow: push immediato di una singola riga dopo una scrittura locale
 */

import { supabase } from './supabase';
import { isElectron } from './localDb';

const SYNC_TABLES: string[] = [
  'clienti', 'parrucchieri', 'trattamenti_catalogo', 'appuntamenti',
  'appuntamento_trattamenti', 'schede_colore', 'fiches', 'fiche_voci',
  'incassi_giornalieri', 'carte_sconto', 'utilizzi_carta_sconto', 'carte_premium',
  'ricariche_carta_premium', 'utilizzi_carta_premium', 'prodotti_rivendita_catalogo',
  'rivendita_prodotti', 'trattamenti_eseguiti', 'impostazioni', 'template_messaggi',
  'assenze_parrucchieri', 'magazzino_prodotti', 'magazzino_movimenti',
  'magazzino_schede_salvate', 'spese_voci', 'schede_clienti_da_confermare',
  'giorni_parrucchiere', 'voci_extra_catalogo',
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

// ─── Supabase -> SQLite (download completo) ───────────────────────────────────

export async function syncSupabaseToLocal(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  for (const table of SYNC_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) {
        if (error) console.warn(`[Sync] Errore lettura ${table}:`, error.message);
        continue;
      }

      // Scarica immagini come base64 per uso offline
      const rows = await Promise.all(
        (data as Record<string, unknown>[]).map(async (row) => {
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

  for (const table of SYNC_TABLES) {
    try {
      const res = await window.electronAPI.db.getDirty(table);
      if (!res.ok || !res.data || (res.data as unknown[]).length === 0) continue;

      await _pushDirtyRows(table, res.data as Record<string, unknown>[], userId);
    } catch (e) {
      console.warn(`[Sync] Errore upload ${table}:`, e);
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
    const { _dirty, synced_at, foto_base64, foto_prima_base64, foto_dopo_base64, ...rest } = row as Record<string, unknown>;
    void _dirty; void synced_at; void foto_base64; void foto_prima_base64; void foto_dopo_base64;
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

// ─── Push di piu' righe dirty ─────────────────────────────────────────────────

async function _pushDirtyRows(
  table: string,
  dirtyRows: Record<string, unknown>[],
  userId: string
): Promise<void> {
  const rows = dirtyRows.map(row => {
    const { _dirty, synced_at, foto_base64, foto_prima_base64, foto_dopo_base64, ...rest } = row;
    void _dirty; void synced_at; void foto_base64; void foto_prima_base64; void foto_dopo_base64;
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
