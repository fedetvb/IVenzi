import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

// ─── Deep link protocol (reset password via email) ───────────────────────────
const PROTOCOL = 'gestionale-salone';

// Registra il protocollo personalizzato (necessario solo nella build packaged)
if (!isDev) {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Tiene in memoria il deep link se l'app era chiusa quando l'utente ha cliccato
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

// Windows: l'istanza già aperta riceve il link tramite secondo processo
app.on('second-instance', (_event, argv) => {
  const url = argv.find(a => a.startsWith(`${PROTOCOL}://`));
  if (url) handleDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: il link arriva tramite 'open-url'
app.on('open-url', (_event, url) => {
  handleDeepLink(url);
});

// Forza istanza singola su Windows/Linux
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ─── Config backup automatico ─────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const CONFIG_PATH = join(USER_DATA, 'auto-backup-config.json');

function readConfig() {
  try {
    if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch { /* ignore */ }
  return { enabled: false, time: '08:00', days: [1, 2, 3, 4, 5], last: '', folder: '' };
}

function writeConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// ─── Finestra principale ──────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Gestionale Salone',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // F12 apre/chiude DevTools per diagnostica
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
  });

  // Invia il deep link pendente una volta che il renderer è pronto
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingDeepLink) {
      mainWindow.webContents.send('deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }
  });
}

app.whenReady().then(() => {
  // Su Windows il deep link arriva come argomento CLI al primo avvio
  const deepLinkArg = process.argv.find(a => a.startsWith(`${PROTOCOL}://`));
  if (deepLinkArg) pendingDeepLink = deepLinkArg;

  createWindow();
  startBackupScheduler();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Scheduler backup automatico ─────────────────────────────────────────────
let schedulerInterval = null;

function startBackupScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  checkAndRunBackup();
  schedulerInterval = setInterval(checkAndRunBackup, 60_000);
}

async function checkAndRunBackup() {
  const cfg = readConfig();
  if (!cfg.enabled) return;

  const now = new Date();
  const todayStr = toLocalDateStr(now);
  if (cfg.last === todayStr) return;
  if (!cfg.days.includes(now.getDay())) return;

  const [hh, mm] = cfg.time.split(':').map(Number);
  if (now.getHours() < hh || (now.getHours() === hh && now.getMinutes() < mm)) return;

  // Invia al renderer per scaricare i dati dal DB
  if (mainWindow) {
    mainWindow.webContents.send('trigger-auto-backup', { todayStr });
  }
}

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('backup:get-config', () => readConfig());

ipcMain.handle('backup:set-config', (_e, cfg) => {
  writeConfig(cfg);
  startBackupScheduler();
  return { ok: true };
});

// Dialogo per scegliere la cartella di destinazione
ipcMain.handle('backup:pick-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Scegli la cartella per i backup automatici',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return { ok: false };
  return { ok: true, folder: filePaths[0] };
});

// Salvataggio silenzioso nella cartella configurata (backup automatico)
ipcMain.handle('backup:save-auto', async (_e, { filename, content }) => {
  const cfg = readConfig();
  const folder = cfg.folder;
  if (!folder) return { ok: false, reason: 'no-folder' };
  try {
    const filePath = join(folder, filename);
    writeFileSync(filePath, content, 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
});

// Dialogo "Salva come" manuale (backup manuale dall'interfaccia)
ipcMain.handle('backup:save-file', async (_e, { filename, content }) => {
  const cfg = readConfig();
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(cfg.folder || app.getPath('documents'), filename),
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, reason: 'canceled' };
  try {
    writeFileSync(filePath, content, 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
});

// Segna il backup automatico come eseguito oggi
ipcMain.handle('backup:mark-done', (_e, { todayStr }) => {
  const cfg = readConfig();
  cfg.last = todayStr;
  writeConfig(cfg);
  return { ok: true };
});

// Apri la cartella nel file explorer
ipcMain.handle('shell:show-folder', (_e, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('shell:show-item', (_e, filePath) => {
  shell.showItemInFolder(filePath);
});
