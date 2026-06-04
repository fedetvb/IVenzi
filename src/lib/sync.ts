/**
 * Sincronizzazione bidirezionale SQLite locale <-> Supabase.
 *
 * Strategia "ultima scrittura vince" basata su updated_at / created_at:
 * - syncSupabaseToLocal: scarica tutto da Supabase e aggiorna il SQLite locale
 *   (le righe vengono marcate _dirty=0 perche' vengono da Supabase)
 * - syncLocalToSupabase: carica le righe con _dirty=1 e le scrive su Supabase
 */

import { supabase } from './supabase';
import { isElectron } from './localDb';

// Tabelle da sincronizzare con le relative colonne select
const SYNC_TABLES: Array<{ table: string; columns: string; softDelete?: boolean }> = [
  { table: 'clienti', columns: '*', softDelete: true },
  { table: 'parrucchieri', columns: '*' },
  { table: 'trattamenti_catalogo', columns: '*' },
  { table: 'appuntamenti', columns: '*', softDelete: true },
  { table: 'appuntamento_trattamenti', columns: '*' },
  { table: 'schede_colore', columns: '*', softDelete: true },
  { table: 'fiches', columns: '*' },
  { table: 'fiche_voci', columns: '*' },
  { table: 'incassi', columns: '*' },
  { table: 'carte_sconto', columns: '*', softDelete: true },
  { table: 'utilizzi_carta_sconto', columns: '*' },
  { table: 'carte_premium', columns: '*', softDelete: true },
  { table: 'ricariche_carte_premium', columns: '*' },
  { table: 'utilizzi_carta_premium', columns: '*' },
  { table: 'prodotti_rivendita_catalogo', columns: '*', softDelete: true },
  { table: 'rivendita_prodotti', columns: '*' },
  { table: 'trattamenti_eseguiti', columns: '*' },
  { table: 'impostazioni', columns: '*' },
  { table: 'template_messaggi', columns: '*' },
  { table: 'assenze_parrucchieri', columns: '*' },
  { table: 'magazzino_prodotti', columns: '*', softDelete: true },
  { table: 'magazzino_movimenti', columns: '*' },
  { table: 'magazzino_schede_salvate', columns: '*' },
  { table: 'spese_voci', columns: '*', softDelete: true },
  { table: 'schede_clienti_da_confermare', columns: '*' },
  { table: 'giorni_parrucchiere', columns: '*' },
  { table: 'voci_extra_catalogo', columns: '*' },
];

// ─── Supabase -> SQLite (download) ────────────────────────────────────────────

export async function syncSupabaseToLocal(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  for (const { table } of SYNC_TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.warn(`[Sync] Errore lettura ${table} da Supabase:`, error.message);
        continue;
      }

      if (!data || data.length === 0) continue;

      await window.electronAPI.db.syncUpsert({ table, rows: data as Record<string, unknown>[] });
    } catch (e) {
      console.warn(`[Sync] Errore sync download ${table}:`, e);
    }
  }
}

// ─── SQLite -> Supabase (upload righe dirty) ──────────────────────────────────

export async function syncLocalToSupabase(userId: string): Promise<void> {
  if (!isElectron() || !window.electronAPI?.db) return;

  for (const { table } of SYNC_TABLES) {
    try {
      const res = await window.electronAPI.db.getDirty(table);
      if (!res.ok || !res.data || (res.data as unknown[]).length === 0) continue;

      const dirtyRows = (res.data as Record<string, unknown>[]).map(row => {
        // Rimuove le colonne solo-locali prima di mandare a Supabase
        const { _dirty, synced_at, ...rest } = row;
        void _dirty; void synced_at;
        return { ...rest, user_id: userId };
      });

      const { error } = await supabase
        .from(table)
        .upsert(dirtyRows, { onConflict: 'id' });

      if (error) {
        console.warn(`[Sync] Errore upload ${table}:`, error.message);
        continue;
      }

      const ids = dirtyRows.map(r => r.id as string).filter(Boolean);
      if (ids.length > 0) {
        await window.electronAPI.db.markSynced(table, ids);
      }
    } catch (e) {
      console.warn(`[Sync] Errore sync upload ${table}:`, e);
    }
  }
}
