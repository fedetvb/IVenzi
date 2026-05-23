import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Config backup automatico
  getBackupConfig: () => ipcRenderer.invoke('backup:get-config'),
  setBackupConfig: (cfg) => ipcRenderer.invoke('backup:set-config', cfg),

  // Seleziona cartella destinazione
  pickBackupFolder: () => ipcRenderer.invoke('backup:pick-folder'),

  // Salvataggio silenzioso nella cartella configurata (backup automatico)
  saveBackupAuto: (filename, content) =>
    ipcRenderer.invoke('backup:save-auto', { filename, content }),

  // Dialogo "Salva come" manuale
  saveBackupFile: (filename, content) =>
    ipcRenderer.invoke('backup:save-file', { filename, content }),

  // Segnala al main che il backup automatico è completato
  markBackupDone: (todayStr) =>
    ipcRenderer.invoke('backup:mark-done', { todayStr }),

  // Evento dal main: è l'ora del backup automatico
  onTriggerAutoBackup: (callback) => {
    ipcRenderer.on('trigger-auto-backup', (_e, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('trigger-auto-backup');
  },

  // Apri cartella / file nel file explorer
  showFolder: (folderPath) => ipcRenderer.invoke('shell:show-folder', folderPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),

  // Deep link per reset password
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (_e, url) => callback(url));
    return () => ipcRenderer.removeAllListeners('deep-link');
  },
});
