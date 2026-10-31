# 🤖 Kelo-1 World (`jeremiahaguirre/Kelo-bot-1`)

Live GitHub Pages URL: **https://jeremiahaguirre.github.io/Kelo-bot-1/**

An autonomous, open-world 3D AI robot simulation set on an island and alpine mountain range in **Kelowna, BC**, inspired by *Pino's World*. Kelo-1 decides what to do on his own: he explores the whole island and mountain, welds sculptures at his workshop, digs for hidden treasures, reads real Wikipedia articles at the NetNode cafe, picks up hobbies, and writes letters asking visitors for things he wants.

Play it in the browser, or install the **Windows app** (below).

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

## 🧠 Kelo-1's Brain
Kelo-1 decides what to do on his own. He isn't limited to a list of actions: each decision can send him anywhere on the island or mountain, weld a sculpture of any shape (always at his welding table first), dig or mine, take up hobbies, form opinions and concepts, ask you questions, request anything he wants, start code projects, research topics and update his worldview.

Decisions come from the first brain that answers:

1. **Gemini** (optional): a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. **Claude** (optional): an Anthropic API key from the [Claude Console](https://platform.claude.com/).
3. **Built-in procedural brain**: needs no key and always works.

On the website, keys are saved only in your own browser and sent only to Google or Anthropic.

> ⚠️ Never commit an API key to this repository. The site is public, so anyone could copy a key from the code.

## 🌙 He keeps growing while you're away
A scheduled GitHub Action (`.github/workflows/dream.yml`) runs every 6 hours: Kelo-1 reads about his curiosities on Wikipedia, reflects, invents concepts and forms core memories, saving them to `brain/growth.json`. The website and the Windows app merge these "dreams" the next time they open.
To give his dreams an AI brain, add `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions** in the repository.

## 📮 Talking to him
Open the **☰ menu** (top right):
- **Talk**: chat with him or suggest a task.
- **Post**: send letters, tools, toys, anything you can name, and photos. Everything waits at the post office until he chooses to pick it up. His own requests arrive as letters; you can send what he asked for or say no.
- **Diary**, **Brain**, **GitHub**, **World**: his thoughts, memories, concepts, hobbies, digs, finds and world controls.

## 📁 Files

```text
Kelo-bot-1/
├── index.html           # The app (also the GitHub Pages entry point)
├── css/style.css
├── js/
│   ├── agent.js         # State, decision engine, AI providers, requests (loaded first)
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
│   ├── scene.js         # Three.js world, pathfinding, terrain
│   ├── items3d.js       # 3D models of items, the pick-up counter, carrying
│   ├── gearmodels.js    # Detailed vehicles and tools, sized against Kelo-1
│   ├── everydaymodels.js # Food, toys, instruments and books at real size
│   ├── storehouse.js    # The Storehouse shelves where everything he owns is kept
│   ├── viewer.js        # Click the Storehouse, the Museum or a photo to look through them
│   ├── museum.js        # His Museum of Art & Ideas: sculptures on plinths, paintings in frames
│   ├── vehicles.js      # The vehicle yard, helipad and dock; driving, boating, hauling dirt
│   ├── landfill.js      # Tipping dug dirt into the lake to make new land
│   ├── disposal.js      # The Disposal Pit: whatever he throws in is gone for good
│   ├── knowhow.js       # Learning how tools work, fuel, and stargazing at night
│   ├── seasons.js       # Seasonal colours, snow, snowfall, and getting stuck in deep snow
│   ├── landscape.js     # Chopping trees, planting, roads and hills, and undoing them
│   ├── projects.js      # Real builds: finding plans online, asking for materials, building them
│   ├── town.js          # Keeps the town free of his builds (the beach is fine)
│   ├── main.js          # UI wiring
│   └── portal.js        # Send-him-something panel
├── brain/growth.json    # His dreams, written by the scheduled Action
├── scripts/dream.mjs    # The dreaming script
├── desktop/             # Windows app (Electron): main process + preload bridge
├── package.json         # Desktop app build configuration
└── .github/workflows/   # dream.yml (dreams) and desktop.yml (Windows build)
```

## 🚀 Going Live on GitHub Pages
1. Push to the `main` branch of `https://github.com/jeremiahaguirre/Kelo-bot-1`.
2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select `main` and `/ (root)`, and click **Save**.
4. Within a minute or two, Kelo-1 will be live at `https://jeremiahaguirre.github.io/Kelo-bot-1/`.
