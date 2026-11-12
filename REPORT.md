# Reference-photo paintings — QA report (branch `agent/refpaint`)

Owner's ask: *"Enable Kelo on Netnode to search DuckDuckGo for live reference images rather than using pre-programmed paintings. Kelo should be able to paint directly from a single search result or creatively combine two different search results into one original painting."*

![contact sheet](contact-sheet.jpg)

`contact-sheet.jpg`: 9 paintings in 6 media (oil, watercolour, gouache, ink, charcoal, pastel, acrylic). Five are from one photo, two combine a subject with a setting, and two are split compositions. Each row shows the reference photo(s), his painting, and the underpainting he worked from. `refpaint-viewer.png` is the Museum viewer with the credit line and the small reference copies, taken from the in-game run.

## What changed
| File | Change |
|---|---|
| `js/refpaint.js` (new, loaded after paintstudio.js) | Search (per-platform sources), safe query cleaning, image loading as data, the underpainting from one or two photos, the NetNode trip, diary and web history, titles, credit line and HTML, bounded thumbnail cache, the AI prompt field |
| `js/paintrender.js` | `renderPaintingInMedium` uses `refpSceneFromReference(spec)` when `spec.refImages` is set. Each medium's brushwork is unchanged. |
| `js/paintstudio.js` | `paintPicture(…, { reference })`: he goes to NetNode first, then paints in the yard. The record gets `subject: 'reference'` and `reference {mode, how, sources[]}`. The plan keeps `reference`. His own paintings, visitor requests ("paint me a lighthouse", "paint a fox in the desert") and the AI decision all pass a reference through. |
| `js/agent.js` | The paint decision JSON gets a `reference` field: `{mode: single\|combine, query, queryB, how: subject-setting\|split, why}` |
| `desktop/imagesearch.js` (new), `desktop/main.js`, `desktop/preload.js` | Electron main does the DuckDuckGo image search (vqd token, then `i.js`) over IPC (`kelo:image-search`, `kelo:image-fetch`) |
| `js/viewer.js`, `js/shop.js`, `js/shopkeeping.js` | The "After a reference photo: …" credit shows in the Museum viewer, the website listing and `shop-data.json` (`credit`) |
| `index.html`, `scripts/build-web.mjs` | `connect-src` adds exactly `https://duckduckgo.com`, `https://commons.wikimedia.org` and `https://upload.wikimedia.org`. `img-src` is unchanged, because pictures are fetched and decoded from blobs or data: URLs. |
| `privacy.html` | New section listing the hosts and what is sent |
| `js/main.js` | Web history links also allow `commons.wikimedia.org` |

## Which source works on which platform
| Platform | 1st | 2nd | 3rd | Offline |
|---|---|---|---|---|
| Windows (Electron) | DuckDuckGo image results through the main process (`kp=1`, `p=1`) | DDG Instant Answer picture | Wikimedia Commons | his own subjects from life |
| iOS / Android (Capacitor) | DuckDuckGo image results through the built-in `CapacitorHttp` (no new plugin) | DDG Instant Answer picture | Wikimedia Commons | same |
| Website (GitHub Pages) | DDG Instant Answer `Image` / `RelatedTopics[].Icon` (the image results endpoint has no CORS) | Wikimedia Commons | — | same |

The diary and web history name the source he used. When the picture came from Commons, the diary says DuckDuckGo had nothing usable.

## How the photo is used
1. **His own crop.** A saliency centroid puts the subject a little off-centre, with a random zoom of up to 1.18x.
2. **Painter's simplification.** He keys the values at half strength toward a full range, reduces to a limited palette of 7 to 16 colours (by skill), merges small islands, keeps 22–44% of the gradients, and shifts toward warm lights and cool shadows.
3. **Medium.** The existing medium painter works on top of this: oil bristle strokes along the forms, watercolour washes, pastel, ink, charcoal, and so on. Beginner blur and wobble still apply.
4. **Combined, subject + setting.** He cuts out the subject of photo A with a two-colour model (centre palette vs. border palette, oval prior, hole fill). He recolours it into B's palette and B's light, places it on a third, and builds one shared palette for the whole picture.
5. **Combined, split.** One photo on each side, or sky and land. Both are harmonised into a joint palette and joined by a 110–140 px wavering blended seam.

## Records, saves and credits
- Each painting record keeps:
  - `mode` and `how`
  - for each source: `query`, `source`, `host` (the page's host), `pageUrl`, `imageUrl`, `title`, `license`, `artist`
- `paintingImages[id].refs` holds 128×96 JPEG copies of the references, about 4 KB each. Only the 40 newest paintings keep them, so the most this adds to a save is about 320 KB.
- Old saves have no new fields and need no migration. The test strips every reference field from a save and reloads it.
- Selling works as before. Reference paintings keep the credit in the listing and in the exported shop data.

## Security
- Search words come from `refpCleanQuery`. It removes tags, URLs, emails, long numbers, the visitor's, companion's and owner's names, and pronouns. It keeps at most 6 words and 60 characters, and refuses anything on the all-ages blocklist.
- The test checks every stubbed request: none contained the visitor's name or email, and every DuckDuckGo call carried `kp=1`.
- Fetched pictures are only decoded into pixels. Fetched text is reduced to plain text with `DOMParser` (Commons artist HTML, which the test tried with `<script>` and `javascript:`). Every title and URL shown goes through `escapeHtml` or `shopEscape`, and links must be https.
- Electron main:
  - only answers the app's own page
  - downloads only picture URLs its own searches returned
  - accepts https and public host names only (no IPs, no localhost or `.local`)
  - follows redirects by hand, checking each hop
  - accepts image MIME types only, up to 6 MB, with a 15 s timeout
- Web: fetches only from the hosts in the CSP, in CORS mode, with no credentials and no referrer, checking type and size.

## Tests (all on Chromium, without a GPU)
- `qa/harness.js refpaint` is the new scenario. It stubs DuckDuckGo and Commons with the fixtures in `qa/fixtures/refpaint`.
- `qa/imagesearch-test.js` unit-tests the Electron search with a fake fetch, including redirects to local addresses, non-image content and unknown URLs. **11/11 pass.**
- Regression runs: reload, ui, chat, vehicle, haul. Results are below.

### Results
| Run | Result |
|---|---|
| `refpaint` (new) | **18/18 PASS**, page errors: none (`logs/refpaint.log`) |
| `qa/imagesearch-test.js` | **11/11 PASS** |
| reload | page errors: none; old disposal record and pit pin survive the reload |
| ui | page errors: none |
| chat | page errors: none |
| vehicle | page errors: none |
| haul | page errors: none; hauled 4 loads into the Disposal Pit |

The `refpaint` scenario checks:
- that single, combined and split paintings get made
- that DuckDuckGo IA is the source for "cat" and Commons is the fallback (and the diary says so)
- that a combine uses two different results
- that Commons HTML is stripped
- that the website listing keeps the credit and the viewer credit is escaped
- that no player data appears in any query, and safe search is on every DuckDuckGo query
- that everything survives a reload (records, full pictures, 1+2+2 reference copies)
- that an old save with every reference field stripped still loads
- that offline he paints his own subject from life

The "Failed to load resource 404" console lines come from the harness's blocked icon CDN and appear on main too.

## Open items
1. **The live endpoints were never reached from the test machine.** The container's proxy blocks duckduckgo.com and wikimedia.org, so everything was tested against stubs that follow the documented response shapes.
   - Undocumented: `i.js` and the vqd token, which DuckDuckGo may change, and whether `duckduckgo.com/i/…` images send CORS headers. If they don't, the website falls through to Commons, which does.
   - Please try once on each platform with a real connection.
2. **The Capacitor path is untested** (no device here). It uses `Capacitor.Plugins.CapacitorHttp`, which ships with @capacitor/core 8. No config change is needed for direct calls.
3. **Wikimedia Commons has no safe-search switch.** Results are filtered on title, categories and description with the same all-ages list. That is a filter, not a guarantee.
4. **Hard case for subject + setting:** a thin subject on a gradient sky (the rocket) brings a patch of its own sky with it. Close-ups and objects on a background work well (cat, coffee cup).
5. In charcoal and ink, very dark night photos come out as mid-grey paper with darks, because that is how those media already handle values.
