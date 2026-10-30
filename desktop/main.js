// Kelo-1 World — Windows desktop app (Electron main process).
// Loads the same web files the GitHub Pages site uses, adds a native Settings menu,
// and keeps API keys encrypted with the operating system's protection (Windows DPAPI).

const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const KEYS_FILE = () => path.join(app.getPath('userData'), 'api-keys.bin');

// --- Kelo-1's memory on disk (up to 10 GB) ---------------------------------------------------
// The web version keeps his brain in browser storage (about 5 MB). In the desktop app every
// saved part of his brain is a file in <userData>/kelo-memory, with a 10 GB budget.
const MEMORY_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
const MEMORY_DIR = () => path.join(app.getPath('userData'), 'kelo-memory');
const memorySizes = new Map();

function memoryFile(key) {
  // Only Kelo-1's own keys, and never API keys (those live in the encrypted key file)
  if (typeof key !== 'string' || !/^kelo1_[a-z0-9_]{1,80}$/i.test(key) || /api_key/i.test(key)) return null;
  return path.join(MEMORY_DIR(), `${key}.json`);
}

function loadMemorySizes() {
  fs.mkdirSync(MEMORY_DIR(), { recursive: true });
  for (const name of fs.readdirSync(MEMORY_DIR())) {
    try { memorySizes.set(name, fs.statSync(path.join(MEMORY_DIR(), name)).size); } catch (e) {}
  }
}

function memoryUsage() {
  let total = 0;
  for (const size of memorySizes.values()) total += size;
  return total;
}

ipcMain.on('kelo:memory-get', (event, key) => {
  const file = memoryFile(key);
  try { event.returnValue = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; } catch (e) { event.returnValue = null; }
});

ipcMain.on('kelo:memory-set', (event, key, value) => {
  const file = memoryFile(key);
  if (!file || typeof value !== 'string') { event.returnValue = { ok: false, error: 'invalid' }; return; }
  const name = path.basename(file);
  const bytes = Buffer.byteLength(value, 'utf8');
  if (memoryUsage() - (memorySizes.get(name) || 0) + bytes > MEMORY_QUOTA_BYTES) {
    event.returnValue = { ok: false, error: 'quota' };
    return;
  }
  try {
    // Write to a temp file first so a crash mid-save never corrupts his memory
    fs.writeFileSync(`${file}.tmp`, value, 'utf8');
    fs.renameSync(`${file}.tmp`, file);
    memorySizes.set(name, bytes);
    event.returnValue = { ok: true };
  } catch (e) {
    event.returnValue = { ok: false, error: e.message };
  }
});

ipcMain.on('kelo:memory-remove', (event, key) => {
  const file = memoryFile(key);
  try { if (file && fs.existsSync(file)) fs.unlinkSync(file); memorySizes.delete(path.basename(file || '')); } catch (e) {}
  event.returnValue = true;
});

ipcMain.on('kelo:memory-keys', (event) => {
  event.returnValue = [...memorySizes.keys()].map(n => n.replace(/\.json$/, ''));
});

ipcMain.on('kelo:memory-usage', (event) => {
  event.returnValue = { used: memoryUsage(), quota: MEMORY_QUOTA_BYTES };
});
const ALLOWED_KEYS = ['gemini', 'anthropic'];

function readKeys() {
  try {
    const raw = fs.readFileSync(KEYS_FILE());
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    const parsed = JSON.parse(json);
    return Object.fromEntries(ALLOWED_KEYS.map(k => [k, typeof parsed[k] === 'string' ? parsed[k] : '']));
  } catch (e) {
    return { gemini: '', anthropic: '' };
  }
}

function writeKeys(keys) {
  const clean = Object.fromEntries(ALLOWED_KEYS.map(k => [k, typeof keys?.[k] === 'string' ? keys[k].trim().slice(0, 300) : '']));
  const json = JSON.stringify(clean);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf8');
  fs.writeFileSync(KEYS_FILE(), data, { mode: 0o600 });
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#020617',
    title: 'Kelo-1 World',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Links (Wikipedia articles, GitHub) open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Kelo-1',
      submenu: [
        { label: 'Settings (API keys)…', accelerator: 'CmdOrCtrl+,', click: () => win.webContents.send('kelo:open-settings') },
        { label: 'Open Menu', accelerator: 'CmdOrCtrl+M', click: () => win.webContents.send('kelo:toggle-menu') },
        { type: 'separator' },
        { label: 'Open Memory Folder', click: () => shell.openPath(MEMORY_DIR()) },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Project on GitHub', click: () => shell.openExternal('https://github.com/jeremiahaguirre/Kelo-bot-1') },
        { label: 'Get a Gemini API key', click: () => shell.openExternal('https://aistudio.google.com/app/apikey') },
        { label: 'Get an Anthropic API key', click: () => shell.openExternal('https://platform.claude.com/') },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.handle('kelo:get-keys', () => readKeys());
ipcMain.handle('kelo:set-keys', (_event, keys) => writeKeys(keys));

app.whenReady().then(() => {
  loadMemorySizes();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
