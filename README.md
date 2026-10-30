# 🤖 Kelo-1 World (`jeremiahaguirre/Kelo-bot-1`)

Live GitHub Pages URL: **https://jeremiahaguirre.github.io/Kelo-bot-1/**

An autonomous, open-world 3D AI robot simulation set on an island and alpine mountain range in **Kelowna, BC**, inspired by *Pino's World*.

## 📁 Connected Repository File Hierarchy

```text
Kelo-bot-1/
├── index.html       # Main application layout & GitHub Pages entrypoint
├── css/
│   └── style.css    # Glassmorphism HUD, 3D floating pins & typography
├── js/
│   ├── agent.js     # Shared state, open decision engine, LLM providers & Supply Broker (loaded first)
│   ├── scene.js     # Three.js 3D island, alpine mountains, tools & raycast ground clamping
│   └── main.js      # UI renderers, button/keyboard handlers & DOM bootstrapper
└── README.md        # Project & GitHub Pages documentation
```

## 🧠 Kelo-1's Brain
Kelo-1 decides what to do on his own. He isn't limited to a list of actions: each decision can send him anywhere on the island (or keep him put), build a sculpture of any shape, change his feelings, form opinions, ask you questions, request gear, start code projects, research topics and update his worldview.

Decisions come from the first brain that answers:

1. **Gemini** (optional): a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. **Claude** (optional): an Anthropic API key from the [Claude Console](https://platform.claude.com/).
3. **Built-in procedural brain**: needs no key and always works.

Add keys with the **AI Brain** button in the header. Keys are saved only in your own browser and sent only to Google or Anthropic.

> ⚠️ Never commit an API key to this repository. The site is public, so anyone could copy a key from the code.

## 🚀 Going Live on GitHub Pages
1. Push to the `main` branch of `https://github.com/jeremiahaguirre/Kelo-bot-1`.
2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, select `main` and `/ (root)`, and click **Save**.
4. Within a minute or two, Kelo-1 will be live at `https://jeremiahaguirre.github.io/Kelo-bot-1/`.