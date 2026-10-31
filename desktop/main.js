// Kelo-1 World — Windows desktop app (Electron main process).
// Loads the same web files the GitHub Pages site uses, adds a native Settings menu,
// and keeps API keys encrypted with the operating system's protection (Windows DPAPI).

const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// The app's own pages (index.html, shop.html...) live in this folder; nothing else is trusted
const APP_DIR = path.join(__dirname, '..');
const APP_URL_PREFIX = pathToFileURL(APP_DIR + path.sep).href;
const MAX_MEMORY_ITEM_BYTES = 256 * 1024 * 1024;

// Only answer requests that come from the app's own page in its own window
function fromAppPage(event) {
  const url = event.senderFrame ? event.senderFrame.url : '';
  return typeof url === 'string' && url.startsWith(APP_URL_PREFIX);
}

// Only https links leave the app, and only to the normal browser
function openExternalSafely(url) {
  try {
    if (new URL(url).protocol === 'https:') shell.openExternal(url);
  } catch (e) {}
}

// One copy of the app at a time, so two windows never write his memory at once
if (!app.requestSingleInstanceLock()) app.quit();

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
  if (!fromAppPage(event)) { event.returnValue = null; return; }
  const file = memoryFile(key);
  try { event.returnValue = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; } catch (e) { event.returnValue = null; }
});

ipcMain.on('kelo:memory-set', (event, key, value) => {
  const file = fromAppPage(event) ? memoryFile(key) : null;
  if (!file || typeof value !== 'string') { event.returnValue = { ok: false, error: 'invalid' }; return; }
  if (Buffer.byteLength(value, 'utf8') > MAX_MEMORY_ITEM_BYTES) { event.returnValue = { ok: false, error: 'too-large' }; return; }
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
  const file = fromAppPage(event) ? memoryFile(key) : null;
  try { if (file && fs.existsSync(file)) fs.unlinkSync(file); memorySizes.delete(path.basename(file || '')); } catch (e) {}
  event.returnValue = true;
});

ipcMain.on('kelo:memory-keys', (event) => {
  if (!fromAppPage(event)) { event.returnValue = []; return; }
  event.returnValue = [...memorySizes.keys()].map(n => n.replace(/\.json$/, ''));
});

ipcMain.on('kelo:memory-usage', (event) => {
  if (!fromAppPage(event)) { event.returnValue = null; return; }
  event.returnValue = { used: memoryUsage(), quota: MEMORY_QUOTA_BYTES };
});
const ALLOWED_KEYS = ['gemini', 'anthropic'];
// If the system can't encrypt (rare), keys are kept in memory for this session only, never written in plain text
let sessionOnlyKeys = null;

function readKeys() {
  if (sessionOnlyKeys) return { ...sessionOnlyKeys };
  try {
    if (!safeStorage.isEncryptionAvailable()) return { gemini: '', anthropic: '' };
    const raw = fs.readFileSync(KEYS_FILE());
    const json = safeStorage.decryptString(raw);
    const parsed = JSON.parse(json);
    return Object.fromEntries(ALLOWED_KEYS.map(k => [k, typeof parsed[k] === 'string' ? parsed[k] : '']));
  } catch (e) {
    return { gemini: '', anthropic: '' };
  }
}

function writeKeys(keys) {
  const clean = Object.fromEntries(ALLOWED_KEYS.map(k => [k, typeof keys?.[k] === 'string' ? keys[k].trim().slice(0, 300) : '']));
  if (!safeStorage.isEncryptionAvailable()) {
    sessionOnlyKeys = clean;
    try { fs.unlinkSync(KEYS_FILE()); } catch (e) {}
    return true;
  }
  const empty = ALLOWED_KEYS.every(k => !clean[k]);
  if (empty) {
    // Removing every key deletes the key file altogether
    try { fs.unlinkSync(KEYS_FILE()); } catch (e) {}
    return true;
  }
  fs.writeFileSync(KEYS_FILE(), safeStorage.encryptString(JSON.stringify(clean)), { mode: 0o600 });
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
      sandbox: true,
      webviewTag: false,
      spellcheck: false
    }
  });

  // Links (Wikipedia articles, GitHub) open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    // His own shop page opens in a window of its own; everything else goes to the normal browser
    if (url.startsWith(APP_URL_PREFIX)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    openExternalSafely(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    // Only the app's own files may load in the window
    if (!url.startsWith(APP_URL_PREFIX)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

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

ipcMain.handle('kelo:get-keys', (event) => (fromAppPage(event) ? readKeys() : { gemini: '', anthropic: '' }));
ipcMain.handle('kelo:set-keys', (event, keys) => (fromAppPage(event) ? writeKeys(keys) : false));

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  // The game never needs the camera, microphone, location or notifications: refuse every request
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  loadMemorySizes();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
