// Kelo-bot-1 — js/native.js
// The bridge between the game and the iOS / Android apps (Capacitor). Only the app build loads it
// (scripts/build-web.mjs adds it to www/index.html before agent.js); on the website and in the
// Windows app it is never loaded, and if it were, it would do nothing outside a phone app.
//
// What it gives the game on a phone:
// - window.keloNative.memory: Kelo-1's memory as files in the app's private storage. keloStore
//   (js/agent.js) reads and writes it synchronously, like localStorage, so everything is read from
//   disk into memory once at startup and every save is written back to disk in the background.
//   The game's startup (its DOMContentLoaded handlers) waits until that first read is done.
// - window.keloNative.getKeys/setKeys: the optional AI keys in the iOS Keychain / Android Keystore,
//   the same shape as the Windows app's window.keloDesktop.
// - The Android back button closes the viewer, settings or menu before leaving the app.
// - Light, readable status bar; gentle vibration for news; an optional "keep the screen on".
// - File downloads (brain backup, shop export) are saved to the phone's Documents / Files app.

(() => {
  const Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return;

  const platform = Cap.getPlatform();
  // Capacitor itself already registers some (SystemBars); register the rest by name
  const plugin = (name) => (Cap.Plugins && Cap.Plugins[name]) || Cap.registerPlugin(name);
  const Filesystem = plugin('Filesystem');
  const App = plugin('App');
  const Haptics = plugin('Haptics');
  const SplashScreen = plugin('SplashScreen');
  const SystemBars = plugin('SystemBars');
  const KeepAwake = plugin('KeepAwake');
  const SecureStorage = window.capacitorSecureStorage && window.capacitorSecureStorage.SecureStorage;

  document.documentElement.classList.add('kelo-native', `kelo-${platform}`);

  // Never leave the splash screen up if something goes wrong at startup
  const hideSplash = () => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
  setTimeout(hideSplash, 12000);

  // --- Kelo-1's memory on the device --------------------------------------------------------------
  // One file per saved key in <app data>/kelo-memory, like the Windows app. A save is written to a
  // temporary file first and then moved into place, so closing the app mid-save never corrupts him.
  const DIR = 'kelo-memory';
  const DATA = 'DATA';
  const cache = new Map();
  const dirty = new Set();
  let flushing = false;
  // If his memory couldn't be read, nothing is written back, so a fresh start never replaces it
  let writesAllowed = false;

  const fileFor = (key) => `${DIR}/${key}.json`;
  // Only his own keys go to disk, and never API keys (those are in the secure store)
  const ownKey = (key) => typeof key === 'string' && /^kelo1_[a-z0-9_]{1,80}$/i.test(key) && !/api_key/i.test(key);

  async function writeOne(key) {
    const path = fileFor(key);
    if (!cache.has(key)) {
      await Filesystem.deleteFile({ path, directory: DATA }).catch(() => {});
      return;
    }
    const data = cache.get(key);
    await Filesystem.writeFile({ path: `${path}.tmp`, data, directory: DATA, encoding: 'utf8', recursive: true });
    await Filesystem.deleteFile({ path, directory: DATA }).catch(() => {});
    await Filesystem.rename({ from: `${path}.tmp`, to: path, directory: DATA, toDirectory: DATA });
  }

  async function flush() {
    if (flushing || !writesAllowed) return;
    flushing = true;
    try {
      while (dirty.size) {
        const key = dirty.values().next().value;
        dirty.delete(key);
        try { await writeOne(key); } catch (e) { console.warn(`Could not save ${key} on the device:`, e); }
      }
    } finally {
      flushing = false;
    }
  }

  async function loadMemory() {
    await Filesystem.mkdir({ path: DIR, directory: DATA, recursive: true }).catch(() => {});
    const { files } = await Filesystem.readdir({ path: DIR, directory: DATA });
    const names = (files || []).map(f => (typeof f === 'string' ? f : f.name));
    // A finished file wins; a leftover .tmp is only used if the app closed between the two steps
    const keys = new Set(names.map(n => n.replace(/\.json(\.tmp)?$/, '')).filter(ownKey));
    for (const key of keys) {
      const pick = names.includes(`${key}.json`) ? `${key}.json` : `${key}.json.tmp`;
      try {
        const { data } = await Filesystem.readFile({ path: `${DIR}/${pick}`, directory: DATA, encoding: 'utf8' });
        if (typeof data === 'string') cache.set(key, data);
      } catch (e) {}
    }
    // Anything saved in the web view's own storage (older test builds) moves over once
    try {
      Object.keys(localStorage).filter(ownKey).forEach(k => {
        if (!cache.has(k)) { cache.set(k, localStorage.getItem(k)); dirty.add(k); }
        localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  const memory = {
    getItem: (key) => (ownKey(key) ? (cache.has(key) ? cache.get(key) : null) : localStorage.getItem(key)),
    setItem: (key, value) => {
      if (!ownKey(key)) return localStorage.setItem(key, value);
      cache.set(key, String(value));
      dirty.add(key);
      flush();
    },
    removeItem: (key) => {
      if (!ownKey(key)) return localStorage.removeItem(key);
      cache.delete(key);
      dirty.add(key);
      flush();
    },
    keys: () => [...new Set([...cache.keys(), ...Object.keys(localStorage)])],
    usage: () => {
      let used = 0;
      cache.forEach(v => { used += v.length; });
      return { used, quota: null };
    }
  };

  // --- AI keys in the Keychain (iOS) or Keystore (Android) -----------------------------------------
  const KEY_ITEM = 'kelo1-ai-keys';
  const ALLOWED_KEYS = ['gemini', 'anthropic'];
  const cleanKeys = (keys) => Object.fromEntries(ALLOWED_KEYS.map(k => [k, typeof keys?.[k] === 'string' ? keys[k].trim().slice(0, 300) : '']));

  async function getKeys() {
    if (!SecureStorage) return cleanKeys({});
    try { return cleanKeys(await SecureStorage.get(KEY_ITEM)); } catch (e) { return cleanKeys({}); }
  }

  async function setKeys(keys) {
    if (!SecureStorage) return false;
    const clean = cleanKeys(keys);
    try {
      if (ALLOWED_KEYS.every(k => !clean[k])) await SecureStorage.remove(KEY_ITEM);
      else await SecureStorage.set(KEY_ITEM, clean);
      return true;
    } catch (e) {
      console.warn('Could not save the AI keys in secure storage:', e);
      return false;
    }
  }

  window.keloNative = { isNative: true, platform, memory, getKeys, setKeys };

  // --- Hold the game's startup until his memory is loaded -----------------------------------------
  // Every game script starts from a DOMContentLoaded handler. Until the memory has been read from
  // disk, new handlers are kept in a list, then run in their original order.
  const held = [];
  const realWindowAdd = window.addEventListener;
  const realDocumentAdd = document.addEventListener;
  window.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') return void held.push([window, fn]);
    return realWindowAdd.call(this, type, fn, opts);
  };
  document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') return void held.push([document, fn]);
    return realDocumentAdd.call(this, type, fn, opts);
  };

  let domReady = false;
  let memoryReady = false;
  let released = false;
  function release() {
    if (released || !domReady || !memoryReady) return;
    released = true;
    window.addEventListener = realWindowAdd;
    document.addEventListener = realDocumentAdd;
    const event = new Event('DOMContentLoaded');
    held.splice(0).forEach(([target, fn]) => {
      try {
        if (typeof fn === 'function') fn.call(target, event);
        else if (fn && typeof fn.handleEvent === 'function') fn.handleEvent(event);
      } catch (e) {
        setTimeout(() => { throw e; }, 0); // still reported, but the other handlers run
      }
    });
    afterStart();
  }
  realDocumentAdd.call(document, 'DOMContentLoaded', () => { domReady = true; release(); });

  const memoryTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 15000));
  Promise.race([loadMemory(), memoryTimeout])
    .then(() => { writesAllowed = true; flush(); })
    .catch((e) => {
      console.warn('Could not read Kelo-1\'s memory from the device; this session will not overwrite it:', e);
      window.keloNative.memoryProblem = true;
    })
    .finally(() => { memoryReady = true; release(); });

  // --- Settings kept on this device only ----------------------------------------------------------
  const SETTINGS_KEY = 'kelo_app_settings';
  const settings = { haptics: true, keepAwake: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
  const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} };
  const applyKeepAwake = () => (settings.keepAwake ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {});

  // --- Once the game is running -------------------------------------------------------------------
  function afterStart() {
    SystemBars.setStyle({ style: 'DARK' }).catch(() => {});
    requestAnimationFrame(() => requestAnimationFrame(hideSplash));
    applyKeepAwake();
    if (window.keloNative.memoryProblem && typeof showToast === 'function') {
      showToast('⚠️ Could not read his memory on this device. Nothing will be saved until the app restarts.');
    }

    // A small tap for news (letters, gifts, discoveries), never more than once every two seconds
    let lastBuzz = 0;
    if (typeof window.showToast === 'function') {
      const realShowToast = window.showToast;
      window.showToast = function (msg) {
        const now = Date.now();
        if (settings.haptics && now - lastBuzz > 2000 && document.visibilityState === 'visible') {
          lastBuzz = now;
          Haptics.impact({ style: 'LIGHT' }).catch(() => {});
        }
        return realShowToast.apply(this, arguments);
      };
    }

    // Save when the app goes to the background (on top of the game's own autosave)
    App.addListener('pause', () => { if (typeof savePersistentBrainStateNow === 'function') savePersistentBrainStateNow(); });
    App.addListener('resume', applyKeepAwake);

    // Android back button: close whatever is open, one layer at a time, then leave the app
    App.addListener('backButton', () => {
      const shown = (id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };
      const click = (id) => document.getElementById(id)?.click();
      if (document.getElementById('keloViewer') && typeof closeViewer === 'function') closeViewer();
      else if (shown('aiConfigModal')) click('btnCloseAIConfigModal');
      else if (shown('codeViewerModal')) click('btnCloseCodeModal');
      else if (document.body.classList.contains('menu-open')) click('btnCloseMenu');
      else App.minimizeApp().catch(() => App.exitApp());
    });

    addPhoneSettings();
  }

  // Two phone-only switches at the bottom of the Settings window
  function addPhoneSettings() {
    const panel = document.querySelector('#aiConfigModal > div');
    if (!panel || document.getElementById('phoneSettings')) return;
    const box = document.createElement('section');
    box.id = 'phoneSettings';
    box.className = 'ui-dialog-section text-xs text-slate-300';
    box.innerHTML = `
      <h4 class="ui-section-title">On this phone</h4>
      <label class="flex items-center justify-between gap-3 min-h-[44px]"><span>Keep the screen on while the app is open</span><input id="phoneKeepAwake" type="checkbox" role="switch" class="ui-toggle"></label>
      <label class="flex items-center justify-between gap-3 min-h-[44px]"><span>Gentle vibration for news</span><input id="phoneHaptics" type="checkbox" role="switch" class="ui-toggle"></label>
      <a href="https://jeremiahaguirre.github.io/Kelo-bot-1/privacy.html" target="_blank" rel="noopener noreferrer" class="inline-block text-2xs text-amber-300 underline underline-offset-2">Privacy policy</a>`;
    panel.appendChild(box);
    const awake = box.querySelector('#phoneKeepAwake');
    const buzz = box.querySelector('#phoneHaptics');
    awake.checked = settings.keepAwake;
    buzz.checked = settings.haptics;
    awake.addEventListener('change', () => { settings.keepAwake = awake.checked; saveSettings(); applyKeepAwake(); });
    buzz.addEventListener('change', () => { settings.haptics = buzz.checked; saveSettings(); });
  }

  // --- Downloads ----------------------------------------------------------------------------------
  // Phone web views can't download files, so a download link (brain backup, shop export) is saved
  // to Documents instead: the Files app on iOS (On My iPhone › Kelo-1 World), Documents on Android.
  realDocumentAdd.call(document, 'click', (e) => {
    const link = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!link || !link.href) return;
    e.preventDefault();
    const name = (link.getAttribute('download') || 'kelo1-file.json').replace(/[^\w.-]+/g, '-');
    fetch(link.href)
      .then(res => res.text())
      .then(data => Filesystem.writeFile({ path: name, data, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true }))
      .then(() => typeof showToast === 'function' && showToast(`Saved ${name} to ${platform === 'ios' ? 'Files › On My iPhone › Kelo-1 World' : 'Documents'}`))
      .catch(err => typeof showToast === 'function' && showToast(`Could not save ${name}: ${err.message || err}`));
  }, true);

  // His shop page opens in the phone's browser (the published one), not inside the game
  const realOpen = window.open;
  window.open = function (url, target, features) {
    try {
      const u = new URL(url, window.location.href);
      if (u.origin === window.location.origin) {
        return realOpen.call(window, `https://jeremiahaguirre.github.io/Kelo-bot-1/${u.pathname.replace(/^\//, '')}`, '_blank');
      }
    } catch (e) {}
    return realOpen.call(window, url, target, features);
  };
})();
