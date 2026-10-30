// Kelo-1 World — the only bridge between the web page and the desktop app.
// Exposes a tiny API: secure key storage and two menu events. Nothing else from Node is available.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keloDesktop', {
  isDesktop: true,
  getKeys: () => ipcRenderer.invoke('kelo:get-keys'),
  setKeys: (keys) => ipcRenderer.invoke('kelo:set-keys', keys),
  onOpenSettings: (callback) => ipcRenderer.on('kelo:open-settings', () => callback()),
  onToggleMenu: (callback) => ipcRenderer.on('kelo:toggle-menu', () => callback()),
  // His memory, stored as files on disk with a 10 GB budget (synchronous, like localStorage)
  memory: {
    getItem: (key) => ipcRenderer.sendSync('kelo:memory-get', key),
    setItem: (key, value) => {
      const result = ipcRenderer.sendSync('kelo:memory-set', key, String(value));
      if (!result || !result.ok) {
        const err = new Error(result && result.error === 'quota' ? 'Kelo-1 memory is full (10 GB)' : 'Could not save memory');
        err.name = result && result.error === 'quota' ? 'QuotaExceededError' : 'Error';
        throw err;
      }
    },
    removeItem: (key) => ipcRenderer.sendSync('kelo:memory-remove', key),
    keys: () => ipcRenderer.sendSync('kelo:memory-keys'),
    usage: () => ipcRenderer.sendSync('kelo:memory-usage')
  }
});
