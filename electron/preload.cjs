const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Backup automatico ──────────────────────────────────────────────────────
  getBackupConfig: () => ipcRenderer.invoke('backup:get-config'),
  setBackupConfig: (cfg) => ipcRenderer.invoke('backup:set-config', cfg),
  pickBackupFolder: () => ipcRenderer.invoke('backup:pick-folder'),
  saveBackupAuto: (filename, content) => ipcRenderer.invoke('backup:save-auto', { filename, content }),
  saveBackupFile: (filename, content) => ipcRenderer.invoke('backup:save-file', { filename, content }),
  markBackupDone: (todayStr) => ipcRenderer.invoke('backup:mark-done', { todayStr }),
  onTriggerAutoBackup: (callback) => {
    ipcRenderer.on('trigger-auto-backup', (_e, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('trigger-auto-backup');
  },

  // ── File explorer ──────────────────────────────────────────────────────────
  showFolder: (folderPath) => ipcRenderer.invoke('shell:show-folder', folderPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),

  // ── Cartelle di salvataggio ────────────────────────────────────────────────
  getFilePaths: () => ipcRenderer.invoke('files:get-paths'),
  setFilePaths: (paths) => ipcRenderer.invoke('files:set-paths', paths),
  pickFolder: (label) => ipcRenderer.invoke('files:pick-folder', { label }),
  saveFileTo: (type, filename, content, encoding) => ipcRenderer.invoke('files:save-auto', { type, filename, content, encoding: encoding || 'utf8' }),

  // ── Scheduler auto-salvataggio fiches ──────────────────────────────────────
  getFichesSched: () => ipcRenderer.invoke('fiches:get-sched'),
  setFichesSched: (cfg) => ipcRenderer.invoke('fiches:set-sched', cfg),
  markFichesDone: (todayStr) => ipcRenderer.invoke('fiches:mark-done', { todayStr }),
  onTriggerAutoFiches: (callback) => {
    ipcRenderer.on('trigger-auto-fiches', (_e, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('trigger-auto-fiches');
  },

  // ── Deep link ──────────────────────────────────────────────────────────────
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (_e, url) => callback(url));
    return () => ipcRenderer.removeAllListeners('deep-link');
  },

  // ── Database locale SQLite ─────────────────────────────────────────────────
  db: {
    isReady: () => ipcRenderer.invoke('db:is-ready'),
    onReady: (callback) => {
      ipcRenderer.on('db:ready', (_e, ready) => callback(ready));
      return () => ipcRenderer.removeAllListeners('db:ready');
    },
    select: (args) => ipcRenderer.invoke('db:select', args),
    insert: (args) => ipcRenderer.invoke('db:insert', args),
    update: (args) => ipcRenderer.invoke('db:update', args),
    delete: (args) => ipcRenderer.invoke('db:delete', args),
    upsert: (args) => ipcRenderer.invoke('db:upsert', args),
    bulkInsert: (args) => ipcRenderer.invoke('db:bulk-insert', args),
    syncUpsert: (args) => ipcRenderer.invoke('db:sync-upsert', args),
    getDirty: (table) => ipcRenderer.invoke('db:get-dirty', { table }),
    markSynced: (table, ids) => ipcRenderer.invoke('db:mark-synced', { table, ids }),
    export: () => ipcRenderer.invoke('db:export'),
    importBackup: (data) => ipcRenderer.invoke('db:import-backup', data),
    getPath: () => ipcRenderer.invoke('db:get-path'),
  },
});
