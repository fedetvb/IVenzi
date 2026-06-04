export interface AutoBackupConfig {
  enabled: boolean;
  time: string;      // "HH:MM"
  days: number[];    // 0=dom … 6=sab
  last: string;      // "YYYY-MM-DD"
  folder: string;    // percorso cartella destinazione
}

export interface DbIpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  success?: boolean;
  results?: Record<string, unknown>;
}

export interface DbFilter {
  col: string;
  op: string;
  val?: unknown;
}

export interface DbOrder {
  col: string;
  asc?: boolean;
}

export interface DbSelectArgs {
  table: string;
  columns?: string;
  filters?: DbFilter[];
  orderBy?: DbOrder[];
  limit?: number | null;
  countOnly?: boolean;
}

export interface DbInsertArgs {
  table: string;
  data: Record<string, unknown>;
  userId?: string;
}

export interface DbUpdateArgs {
  table: string;
  id: string;
  data: Record<string, unknown>;
}

export interface DbDeleteArgs {
  table: string;
  filters: DbFilter[];
}

export interface DbUpsertArgs {
  table: string;
  data: Record<string, unknown>;
  onConflict?: string;
  userId?: string;
}

export interface DbAPI {
  isReady: () => Promise<boolean>;
  onReady: (callback: (ready: boolean) => void) => () => void;
  select: (args: DbSelectArgs) => Promise<DbIpcResult>;
  insert: (args: DbInsertArgs) => Promise<DbIpcResult>;
  update: (args: DbUpdateArgs) => Promise<DbIpcResult>;
  delete: (args: DbDeleteArgs) => Promise<DbIpcResult>;
  upsert: (args: DbUpsertArgs) => Promise<DbIpcResult>;
  bulkInsert: (args: { table: string; rows: Record<string, unknown>[]; userId?: string }) => Promise<DbIpcResult>;
  syncUpsert: (args: { table: string; rows: Record<string, unknown>[] }) => Promise<DbIpcResult>;
  getDirty: (table: string) => Promise<DbIpcResult>;
  markSynced: (table: string, ids: string[]) => Promise<DbIpcResult>;
  export: () => Promise<DbIpcResult<Record<string, unknown[]>>>;
  importBackup: (data: Record<string, unknown>) => Promise<DbIpcResult & { success?: boolean; results?: Record<string, unknown> }>;
  getPath: () => Promise<{ path: string; exists: boolean }>;
}

export interface ElectronAPI {
  getBackupConfig: () => Promise<AutoBackupConfig>;
  setBackupConfig: (cfg: AutoBackupConfig) => Promise<{ ok: boolean }>;
  pickBackupFolder: () => Promise<{ ok: boolean; folder?: string }>;
  saveBackupAuto: (filename: string, content: string) => Promise<{ ok: boolean; filePath?: string; reason?: string }>;
  saveBackupFile: (filename: string, content: string) => Promise<{ ok: boolean; filePath?: string; reason?: string }>;
  markBackupDone: (todayStr: string) => Promise<{ ok: boolean }>;
  onTriggerAutoBackup: (cb: (data: { todayStr: string }) => void) => () => void;
  showFolder: (folderPath: string) => void;
  showItemInFolder: (filePath: string) => void;
  onDeepLink: (cb: (url: string) => void) => () => void;
  db?: DbAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
