export interface AutoBackupConfig {
  enabled: boolean;
  time: string;      // "HH:MM"
  days: number[];    // 0=dom … 6=sab
  last: string;      // "YYYY-MM-DD"
  folder: string;    // percorso cartella destinazione
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
