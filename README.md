# 🤖 Kelo-1 World (`jeremiahaguirre/Kelo-bot-1`)

Live GitHub Pages URL: **https://jeremiahaguirre.github.io/Kelo-bot-1/**

An autonomous, open-world 3D AI robot simulation set on an island and alpine mountain range in **Kelowna, BC**, inspired by *Pino's World*. Kelo-1 decides what to do on his own: he explores the whole island and mountain, welds sculptures at his workshop, digs for hidden treasures, reads real Wikipedia articles at the NetNode cafe, picks up hobbies, and writes letters asking visitors for things he wants.

Play it in the browser, install the **Windows app** (below), or build the **iPhone/iPad and Android apps** ([docs/MOBILE.md](docs/MOBILE.md)).

## 💻 Install on Windows

### Option A: download the ready-made app
1. Open the repository on GitHub and go to **Releases** (right-hand side of the main page).
   If there is no release yet, go to **Actions → Build Windows app → Run workflow**, wait for it to finish (about 5–10 minutes), open the finished run, and download **Kelo-1-World-Windows** under *Artifacts* (it's a .zip; extract it).
2. You will have two files. Pick one:
   - **`Kelo-1-World-Setup-x.y.z.exe`**: the installer. Double-click it, choose where to install, and it adds a desktop and Start-menu shortcut.
   - **`Kelo-1-World-Portable-x.y.z.exe`**: no installation; double-click to run it from anywhere (even a USB stick).
3. Windows may show **"Windows protected your PC"** because the app isn't code-signed. Click **More info → Run anyway**.
4. Kelo-1 World opens in its own window. An internet connection is needed (for the 3D engine, Wikipedia browsing and the optional AI brain).

### Add your API keys (optional)
Click the **⚙️ gear icon** in the top-right corner (or use the menu **Kelo-1 → Settings (API keys)…**, or press **Ctrl+,**). Paste a Gemini and/or Anthropic key and click **Save Agent Config**.
In the Windows app, keys are encrypted with Windows' own protection and stored separately from his memory.

### Where his memory lives
The Windows app keeps Kelo-1's memory as files on your computer with room for **up to 10 GB**: years of diary entries, his photo wall at a higher resolution, concepts, hobbies, digs and more.
Open the folder from the menu **Kelo-1 → Open Memory Folder** (it's in `%APPDATA%\Kelo-1 World\kelo-memory`). Use **Diary → Back Up His Brain** to save a backup file, and **Restore From Backup** to move him between computers or between the website and the app.

### Uninstall
Use **Settings → Apps → Installed apps → Kelo-1 World → Uninstall** (installer version), or just delete the portable .exe. His memory folder stays until you delete it.

### Build it yourself (developers)
Requires [Node.js 20+](https://nodejs.org/).
```bash
npm install
```
```bash
npm start
```
```bash
npm run dist:win
```
`npm start` runs the app; `npm run dist:win` builds the installer and portable .exe into `dist/` (run it on Windows).

## 📱 iPhone, iPad and Android apps
The same game, wrapped as real phone apps with [Capacitor](https://capacitorjs.com/). They work offline (three.js, icons, fonts and styles are built in), keep his memory in the app's own storage, keep AI keys in the iOS Keychain / Android Keystore, respect the notch, and close menus with Android's back button.

```bash
npm install
npm run cap:sync        # builds www/ (the offline copy of the game) and copies it into android/ and ios/
npm run android:open    # opens Android Studio
npm run ios:open        # opens Xcode (Mac only)
```
GitHub Actions builds them too (**Actions → Build phone apps**). Everything about running them on a phone, signing and publishing to the App Store and Google Play is in **[docs/MOBILE.md](docs/MOBILE.md)**. Privacy policy: [privacy.html](privacy.html).

## 🧠 Kelo-1's Brain
Kelo-1 decides what to do on his own. He isn't limited to a list of actions: each decision can send him anywhere on the island or mountain, weld a sculpture of any shape (always at his welding table first), dig or mine, take up hobbies, form opinions and concepts, ask you questions, request anything he wants, start code projects, research topics and update his worldview.

Decisions come from the first brain that answers:

1. **Gemini** (optional): a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. **Claude** (optional): an Anthropic API key from the [Claude Console](https://platform.claude.com/).
3. **Built-in procedural brain**: needs no key and always works.

On the website, keys are saved only in your own browser and sent only to Google or Anthropic.

> ⚠️ Never commit an API key to this repository. The site is public, so anyone could copy a key from the code.

## 🌙 He keeps growing while you're away
A scheduled GitHub Action (`.github/workflows/dream.yml`) runs every 6 hours: Kelo-1 reads about his curiosities on Wikipedia, reflects, invents concepts and forms core memories, saving them to `brain/growth.json`. The website, the Windows app and the phone apps merge these "dreams" the next time they open.
To give his dreams an AI brain, add `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions** in the repository.

## 📮 Talking to him
Open the **☰ menu** (top right):
- **Talk**: chat with him or suggest a task.
- **Post**: send letters, tools, toys, anything you can name, and photos. Everything waits at the post office until he chooses to pick it up. His own requests arrive as letters; you can send what he asked for or say no.
- **Diary**, **Brain**, **GitHub**, **World**: his thoughts, memories, concepts, hobbies, digs, finds and world controls.

## 🧭 Looking around
- **🎯 Follow Kelo-1** keeps him in view; **🧭 Explore** lets you fly anywhere. Drag the ground to slide the map, right-drag (or twist two fingers) to turn, scroll (or pinch) to zoom, WASD or the arrow keys to move, Q/E to turn, K to fly back to him.
- Double-click a spot to fly there. A single click opens a small menu: **Fly here**, **Send Kelo-1 here**, **What's this?**
- The **map** (bottom left) shows him, his vehicles, digs and builds; click it to fly there. **📍 Places** jumps to any building, dig or project. **?** shows all the controls.
- The menu's **World → Try it** panel previews winter, night or a gale (only for this visit) and sends him sample gifts.

## 📁 Files

```text
Kelo-bot-1/
├── index.html           # The app (also the GitHub Pages entry point)
├── shop.html            # Kelo-1's shop website (reads his save, or shop-data.json once you export and commit it)
├── privacy.html         # Privacy policy (for the app stores, too)
├── css/style.css
├── css/native.css       # Phone apps only: keeps the UI clear of the notch and home bar
├── js/                # Listed in the order index.html loads them
│   ├── vendor/GLTFLoader.js # three.js r128's glTF loader (loaded right after three.js)
│   ├── native.js        # Phone apps only (added by the www build before agent.js): device storage, secure keys, back button
│   ├── agent.js         # State, decision engine, AI providers, requests (loaded first)
│   ├── loopguard.js     # Keeps him out of decision loops: no 3-in-a-row, cooldowns for blocked jobs, no repeated plans
│   ├── memory.js        # Long-term memory, core memories, backups
│   ├── worldclock.js    # His calendar: 12-hour days, 365-day years, seasons
│   ├── needs.js         # Food, water and sleep, which he has to discover
│   ├── forms.js         # Shapes for things he builds
│   ├── netnode.js       # Real Wikipedia browsing at the NetNode cafe
│   ├── conversation.js  # Understanding what visitors say; looking up words he doesn't know
│   ├── postoffice.js    # Mail he picks up when he chooses
│   ├── workshop.js      # Everything is welded at the workshop, carried and placed
│   ├── hobbies.js       # Hobbies sparked by items (murals, kites, music...)
│   ├── mining.js        # Digging, equipment needs, hidden finds
│   ├── growth.js        # Merges what he dreamt while you were away
│   ├── kelo-body.js     # Kelo-1's cute robot body and rig: big head, blinking mood eyes, bouncy antenna, jointed arms, hands and legs
│   ├── scene.js         # Three.js world, pathfinding, terrain
│   ├── realism.js       # Realistic look: real colours, filmic tone mapping, sky and sun from his clock, HDR lighting, lake, textured ground, trees, Graphics setting
│   ├── weldstudio.js    # The Welding Studio as a real fab shop: steel table, MIG welder, gas bottles, grinder, fume arm, arc glow
│   ├── house.js         # Kelo-1's cottage: walls, windows, porch, roof, furniture, night lights
│   ├── animations.js    # Kelo-1's body animation: smooth pose blending, walk cycle, idle life, emotes
│   ├── items3d.js       # 3D models of items, the pick-up counter, carrying
│   ├── gearmodels.js    # Detailed vehicles and tools, sized against Kelo-1
│   ├── everydaymodels.js # Food, toys, instruments and books at real size
│   ├── materials.js     # What things are made of, how they look, bend, snap or shatter; food flavours and his tastes
│   ├── realmodels.js    # Real 3D models (glTF files in assets/models/) that replace the drawn ones once loaded
│   ├── perf.js          # Staying smooth: the Performance setting, building the Storehouse and Museum only when seen, hiding far-away things
│   ├── storehouse.js    # The Storehouse shelves where everything he owns is kept
│   ├── museum.js        # His Museum of Art & Ideas: sculptures on plinths, paintings in frames
│   ├── basements.js     # Walking into the Storehouse and Museum: shelves, spiral stairs, lit basements seen through a cutaway
│   ├── viewer.js        # Click the Storehouse, the Museum or a photo to look through them
│   ├── tidyup.js        # Every half hour he goes through his things and throws out what he doesn't need
│   ├── takeout.js       # Taking things back out of the Museum and Storehouse to use or throw out
│   ├── vehicles.js      # The vehicle yard, helipad and dock; driving, boating, hauling dirt
│   ├── landfill.js      # Tipping dug dirt into the lake to make new land
│   ├── disposal.js      # The Disposal Pit: whatever he throws in is gone for good
│   ├── knowhow.js       # Learning how tools work, fuel, and stargazing at night
│   ├── itemuse.js       # What each thing is for, and how much is left of things that get used up
│   ├── seasons.js       # Seasonal colours, snow, snowfall, and getting stuck in deep snow
│   ├── wind.js          # Wind over his days: kites need it, balloons crash in it and get welded back
│   ├── weather.js       # Spring rain (puddles, wet ground, faster-growing plants) and winter lake ice he learns to test
│   ├── landscape.js     # Chopping trees, planting, roads and hills, and undoing them
│   ├── groundwork.js    # Researching how roads, paving, earthwork and planting are done; the right tools, used in turn
│   ├── skills.js        # Real skills: practising the vehicles, telescope and hobbies he was given; doing what visitors ask
│   ├── projects.js      # Real builds: finding plans online, asking for materials (or sawing his own logs), building them
│   ├── town.js          # Keeps the town free of his builds (the beach is fine)
│   ├── coderequests.js  # Code requests: features he asks his human to code into his world
│   ├── wishfeatures.js  # Which code requests match a built feature: "Ready to switch on" or "Needs new code"
│   ├── wildlife.js      # Songbird flocks and mule deer in the meadow; walking up quietly to study them
│   ├── companions.js    # His robot friend (follows, carries, hands tools, keeps watch) and his pet dog or cat
│   ├── pastimes.js      # Fishing, the stove, real music sounds, swimming, the campfire, named constellations
│   ├── shopkeeping.js   # His shop in the game: listing things for sale, "Sold", earnings, Export shop
│   ├── printer.js       # His 3D printer: setting it up, learning it, filament spools, prints that fail and succeed
│   ├── main.js          # UI wiring
│   ├── portal.js        # Send-him-something panel
│   ├── explore.js       # Looking around: Follow Kelo-1 or Explore freely, Places, the click menu, help card, touch joystick
│   ├── minimap.js       # The live minimap: terrain, buildings, his vehicles, digs and builds, Kelo-1 and the camera's view, and the Map tab of everything he has changed
│   ├── tryit.js         # The World tab's Try it panel: preview seasons, night and wind, send sample gifts
│   ├── shop.js          # The shop website itself (shop.html)
│   └── vendor/          # The other three.js r128 add-ons (Sky, RGBELoader, bloom post-processing), kept in the repo
├── assets/
│   ├── models/          # Real-world 3D models (.glb) of everyday things
│   ├── hdri/            # HDR sky photos that light the world by day, at sunset and at night
│   ├── textures/        # Lake ripples and the tiling ground textures (grass, dirt, rock, sand, snow)
│   └── LICENSES.md      # Where each model, photo and texture came from, its author and licence
├── brain/growth.json    # His dreams, written by the scheduled Action
├── scripts/dream.mjs    # The dreaming script
├── scripts/terrain-textures.py # Makes the tiling ground textures in assets/textures/terrain
├── desktop/             # Windows app (Electron): main process + preload bridge
├── android/, ios/       # Phone app projects (Capacitor); open them in Android Studio / Xcode
├── capacitor.config.json # Phone app settings (app id, splash screen, status bar)
├── scripts/build-web.mjs # Builds www/, the offline copy of the game inside the phone apps (not committed)
├── scripts/make-icons.mjs # Makes the app icon and splash from resources/icon.svg
├── resources/           # App icon and splash screen sources
├── docs/MOBILE.md       # Phone apps: running, signing, publishing
├── package.json         # Desktop and phone app build configuration
└── .github/workflows/   # dream.yml (dreams), desktop.yml (Windows build), mobile.yml (Android and iOS builds)
```

## 🚀 Going Live on GitHub Pages
1. Push to the `main` branch of `https://github.com/jeremiahaguirre/Kelo-bot-1`.
2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select `main` and `/ (root)`, and click **Save**.
4. Within a minute or two, Kelo-1 will be live at `https://jeremiahaguirre.github.io/Kelo-bot-1/`.
