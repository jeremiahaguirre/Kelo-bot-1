// Kelo-bot-1 — js/forms.js
// Loaded after agent.js. Recognisable forms for the things Kelo-1 decides to build, so a
// "heron" looks like a heron and a "lighthouse" like a lighthouse. Each template returns
// sculpture parts in the same format the AI brain uses (see sanitizeParts in agent.js).
// When nothing matches and no AI brain is available, the build is honestly named abstract.

// Part helper: basic shapes take sizes; extra fields (profile/outline/path, spin, emissive) pass through
const P = (shape, x, y, z, sx, sy, sz, color, extra = {}) => ({ shape, x, y, z, sx, sy, sz, color, ...extra });

const SUBJECT_FORMS = [
  [/heron|crane|stork|flamingo/, 'Heron', (c) => [
    P('sphere', 0, 1.6, 0, 0.9, 0.6, 0.6, c.main),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[0.35, 1.7, 0], [0.55, 2.3, 0], [0.45, 2.8, 0], [0.6, 3.0, 0]], radius: 0.07 }),
    P('sphere', 0.65, 3.0, 0, 0.3, 0.3, 0.3, c.main),
    P('cone', 1.0, 3.0, 0, 0.12, 0.6, 0.12, '#f59e0b', { rz: -Math.PI / 2 }),
    P('cylinder', -0.12, 0.65, 0.1, 0.08, 1.3, 0.08, '#475569'),
    P('cylinder', 0.12, 0.65, -0.1, 0.08, 1.3, 0.08, '#475569'),
    P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[-0.4, 1.5], [-1.4, 1.9], [-0.5, 1.9]], depth: 0.05, z: 0.3 })
  ]],
  [/bird|eagle|owl|pigeon|sparrow|robin|hawk|gull/, 'Bird', (c) => [
    P('sphere', 0, 1.2, 0, 0.9, 0.7, 0.7, c.main),
    P('sphere', 0.55, 1.6, 0, 0.5, 0.5, 0.5, c.main),
    P('cone', 0.85, 1.6, 0, 0.12, 0.3, 0.12, '#f59e0b', { rz: -Math.PI / 2 }),
    P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[-0.3, 1.3], [-0.9, 2.2], [0.3, 1.5]], depth: 0.05, z: 0.35 }),
    P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[-0.3, 1.3], [-0.9, 2.2], [0.3, 1.5]], depth: 0.05, z: -0.35 }),
    P('cylinder', 0, 0.45, 0, 0.12, 0.9, 0.12, '#475569')
  ]],
  [/duck|goose|swan/, 'Duck', (c) => [
    P('sphere', 0, 0.5, 0, 1.3, 0.8, 0.9, c.main),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[0.45, 0.7, 0], [0.6, 1.2, 0], [0.55, 1.5, 0]], radius: 0.12 }),
    P('sphere', 0.6, 1.6, 0, 0.4, 0.4, 0.4, c.main),
    P('cone', 0.85, 1.55, 0, 0.12, 0.3, 0.12, '#f59e0b', { rz: -Math.PI / 2 })
  ]],
  [/fish|salmon|trout|koi/, 'Fish', (c) => [
    P('sphere', 0, 1.2, 0, 1.6, 0.8, 0.5, c.main),
    P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[-0.9, 1.2], [-1.6, 1.7], [-1.6, 0.7]], depth: 0.08 }),
    P('sphere', 0.6, 1.35, 0.22, 0.15, 0.15, 0.15, '#0f172a'),
    P('cylinder', 0, 0.35, 0, 0.12, 0.7, 0.12, '#475569')
  ]],
  [/whale|dolphin|orca/, 'Whale', (c) => [
    P('sphere', 0, 1.0, 0, 2.4, 1.0, 1.0, c.main),
    P('extrude', 0, 0, 0, 1, 1, 1, c.main, { outline: [[-1.3, 1.1], [-2.2, 1.8], [-2.0, 1.1], [-2.2, 0.5]], depth: 0.1 }),
    P('tube', 0, 0, 0, 1, 1, 1, '#bae6fd', { path: [[0.6, 1.6, 0], [0.6, 2.3, 0], [0.4, 2.6, 0]], radius: 0.05 })
  ]],
  [/serpent|ogopogo|dragon|snake|sea monster|eel/, 'Sea Dragon', (c) => [
    // Coiling body built from tapering tube sections, then a horned head with a snout
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[-2.4, 0.1, 0], [-2.0, 0.5, 0.1], [-1.6, 0.15, 0]], radius: 0.1 }),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[-1.6, 0.15, 0], [-1.1, 0.9, -0.1], [-0.6, 0.2, 0]], radius: 0.2 }),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[-0.6, 0.2, 0], [0.0, 1.1, 0.1], [0.5, 0.25, 0]], radius: 0.28 }),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[0.5, 0.25, 0], [1.1, 1.2, 0], [1.4, 2.2, 0], [1.6, 2.8, 0]], radius: 0.22 }),
    P('sphere', 1.75, 3.0, 0, 0.75, 0.55, 0.6, c.main),
    P('cone', 2.25, 2.95, 0, 0.32, 0.6, 0.32, c.main, { rz: -Math.PI / 2 }),
    P('box', 2.15, 2.75, 0, 0.6, 0.08, 0.28, '#bef264', { rz: -0.15 }),
    P('sphere', 1.95, 3.15, 0.25, 0.12, 0.12, 0.12, '#fde047', { emissive: true }),
    P('sphere', 1.95, 3.15, -0.25, 0.12, 0.12, 0.12, '#fde047', { emissive: true }),
    P('cone', 1.45, 3.4, 0.15, 0.1, 0.55, 0.1, '#fef3c7', { rz: 0.9 }),
    P('cone', 1.45, 3.4, -0.15, 0.1, 0.55, 0.1, '#fef3c7', { rz: 0.9 }),
    ...[-1.1, 0.0, 1.1].map(x => P('cone', x, x === 0 ? 1.45 : 1.25, 0, 0.12, 0.4, 0.12, c.accent)),
    P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[-2.4, 0.1], [-2.9, 0.6], [-2.7, 0.1], [-2.9, -0.3]], depth: 0.04 })
  ]],
  [/tree|fir|pine|forest|oak|maple|douglas/, 'Tree', (c) => [
    P('cylinder', 0, 0.8, 0, 0.35, 1.6, 0.35, '#8a5a2b'),
    P('cone', 0, 2.2, 0, 1.8, 1.6, 1.8, '#1f9a4b'),
    P('cone', 0, 3.1, 0, 1.4, 1.3, 1.4, '#22c55e'),
    P('cone', 0, 3.8, 0, 0.9, 1.0, 0.9, '#4ade80')
  ]],
  [/flower|dandelion|bloom|blossom|rose|daisy|wildflower|petal/, 'Flower', (c) => [
    P('cylinder', 0, 1.0, 0, 0.12, 2.0, 0.12, '#2f9e44'),
    P('extrude', 0, 0, 0, 1, 1, 1, '#4ade80', { outline: [[0, 0.8], [0.6, 1.1], [0.1, 1.0]], depth: 0.04 }),
    ...Array.from({ length: 6 }, (_, i) => P('sphere', Math.cos(i / 6 * Math.PI * 2) * 0.45, 2.2, Math.sin(i / 6 * Math.PI * 2) * 0.45, 0.5, 0.25, 0.5, c.main)),
    P('sphere', 0, 2.25, 0, 0.4, 0.4, 0.4, '#facc15', { emissive: true })
  ]],
  [/mushroom|mycelium|toadstool|fungi|fungus/, 'Mushroom', (c) => [
    P('cylinder', 0, 0.6, 0, 0.6, 1.2, 0.6, '#fef3c7'),
    P('lathe', 0, 1.1, 0, 1, 1, 1, c.main, { profile: [[0.1, 0], [1.3, 0.05], [1.2, 0.4], [0.8, 0.8], [0.01, 1.0]] }),
    P('sphere', 0.5, 1.7, 0.4, 0.2, 0.2, 0.2, '#ffffff'),
    P('sphere', -0.4, 1.8, -0.2, 0.18, 0.18, 0.18, '#ffffff')
  ]],
  [/house|cabin|hut|shelter|home|cottage/, 'House', (c) => [
    P('box', 0, 0.7, 0, 2.0, 1.4, 1.6, c.main),
    P('cone', 0, 1.9, 0, 1.6, 1.0, 1.6, c.accent, { ry: Math.PI / 4 }),
    P('box', 0, 0.45, 0.81, 0.45, 0.9, 0.05, '#7c2d12'),
    P('box', 0.6, 0.9, 0.81, 0.35, 0.35, 0.05, '#bae6fd', { emissive: true })
  ]],
  [/lighthouse|beacon/, 'Lighthouse', (c) => [
    P('lathe', 0, 0, 0, 1, 1, 1, '#f8fafc', { profile: [[0.8, 0], [0.7, 1.0], [0.6, 2.0], [0.5, 3.0], [0.01, 3.0]] }),
    P('torus', 0, 1.0, 0, 1.4, 0.6, 1.4, '#ef4444', { rx: Math.PI / 2 }),
    P('torus', 0, 2.0, 0, 1.2, 0.6, 1.2, '#ef4444', { rx: Math.PI / 2 }),
    P('cylinder', 0, 3.3, 0, 1.0, 0.6, 1.0, '#fef08a', { emissive: true }),
    P('cone', 0, 3.9, 0, 0.8, 0.6, 0.8, '#ef4444')
  ]],
  [/tower|spire|antenna|obelisk/, 'Tower', (c) => [
    P('cylinder', 0, 0.3, 0, 1.6, 0.6, 1.6, c.accent),
    P('cylinder', 0, 1.8, 0, 0.8, 2.6, 0.8, c.main),
    P('cone', 0, 3.6, 0, 0.9, 1.0, 0.9, c.accent),
    P('sphere', 0, 4.2, 0, 0.3, 0.3, 0.3, '#fde047', { emissive: true })
  ]],
  [/bridge|arch|gate|portal|doorway/, 'Arch', (c) => [
    P('cylinder', -1.0, 0.9, 0, 0.5, 1.8, 0.5, c.accent),
    P('cylinder', 1.0, 0.9, 0, 0.5, 1.8, 0.5, c.accent),
    P('tube', 0, 0, 0, 1, 1, 1, c.main, { path: [[-1.0, 1.8, 0], [-0.7, 2.6, 0], [0, 2.9, 0], [0.7, 2.6, 0], [1.0, 1.8, 0]], radius: 0.22 }),
    P('octahedron', 0, 3.2, 0, 0.4, 0.4, 0.4, c.main, { emissive: true, spin: true })
  ]],
  [/boat|sailboat|ship|canoe|kayak|raft/, 'Boat', (c) => [
    P('lathe', 0, 0.2, 0, 1, 1, 1, c.accent, { profile: [[0.01, 0], [0.5, 0.15], [0.7, 0.5]], rz: Math.PI / 2, x: 0 }),
    P('box', 0, 0.45, 0, 2.2, 0.35, 0.8, c.accent),
    P('cylinder', 0, 1.6, 0, 0.08, 2.2, 0.08, '#8a5a2b'),
    P('extrude', 0, 0, 0, 1, 1, 1, '#f8fafc', { outline: [[0.05, 0.8], [0.05, 2.6], [1.0, 0.9]], depth: 0.03 })
  ]],
  [/rocket|spaceship|space ship|shuttle/, 'Rocket', (c) => [
    P('cylinder', 0, 1.6, 0, 0.8, 2.4, 0.8, '#f8fafc'),
    P('cone', 0, 3.2, 0, 0.8, 0.9, 0.8, c.main),
    P('sphere', 0, 2.0, 0.42, 0.3, 0.3, 0.1, '#38bdf8', { emissive: true }),
    ...[0, 1, 2].map(i => P('extrude', 0, 0, 0, 1, 1, 1, c.accent, { outline: [[0.35, 0.3], [0.9, 0.1], [0.35, 1.0]], depth: 0.05, ry: i * Math.PI * 2 / 3 })),
    P('cone', 0, 0.2, 0, 0.5, 0.5, 0.5, '#f97316', { emissive: true, rx: Math.PI })
  ]],
  [/robot|self[- ]portrait|reflection|kelo|android|servo/, 'Robot', (c) => [
    P('box', 0, 1.3, 0, 1.0, 1.1, 0.7, c.main),
    P('box', 0, 2.2, 0, 0.75, 0.6, 0.6, c.accent),
    P('sphere', -0.17, 2.25, 0.31, 0.12, 0.12, 0.05, '#22d3ee', { emissive: true }),
    P('sphere', 0.17, 2.25, 0.31, 0.12, 0.12, 0.05, '#22d3ee', { emissive: true }),
    P('cylinder', 0, 2.75, 0, 0.05, 0.4, 0.05, '#94a3b8'),
    P('sphere', 0, 3.0, 0, 0.15, 0.15, 0.15, '#f43f5e', { emissive: true }),
    P('cylinder', -0.65, 1.3, 0, 0.18, 1.0, 0.18, c.accent),
    P('cylinder', 0.65, 1.3, 0, 0.18, 1.0, 0.18, c.accent),
    P('cylinder', -0.25, 0.4, 0, 0.22, 0.8, 0.22, '#475569'),
    P('cylinder', 0.25, 0.4, 0, 0.22, 0.8, 0.22, '#475569')
  ]],
  [/star|constellation|night sky|stars/, 'Star', (c) => [
    P('cylinder', 0, 0.8, 0, 0.12, 1.6, 0.12, '#94a3b8'),
    P('extrude', 0, 0, 0, 1, 1, 1, '#facc15', { outline: Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 0.45 : 1.0; return [Math.cos(a) * r, 2.4 + Math.sin(a) * r]; }), depth: 0.2, emissive: true, spin: true })
  ]],
  [/sun\b|sunrise|sunset|sunshine/, 'Sun', (c) => [
    P('cylinder', 0, 0.8, 0, 0.12, 1.6, 0.12, '#94a3b8'),
    P('sphere', 0, 2.4, 0, 1.2, 1.2, 1.2, '#facc15', { emissive: true }),
    ...Array.from({ length: 8 }, (_, i) => P('cone', Math.cos(i / 8 * Math.PI * 2) * 1.1, 2.4 + Math.sin(i / 8 * Math.PI * 2) * 1.1, 0, 0.2, 0.5, 0.2, '#f97316', { rz: i / 8 * Math.PI * 2 - Math.PI / 2 }))
  ]],
  [/moon/, 'Moon', (c) => [
    P('cylinder', 0, 0.8, 0, 0.12, 1.6, 0.12, '#94a3b8'),
    P('extrude', 0, 0, 0, 1, 1, 1, '#fef9c3', { outline: Array.from({ length: 16 }, (_, i) => { const a = i / 15 * Math.PI * 1.6 - Math.PI * 0.8; return i < 8 ? [Math.cos(a) * 1.0, 2.4 + Math.sin(a) * 1.0] : [Math.cos(a) * 0.7 + 0.35, 2.4 + Math.sin(a) * 0.7]; }), depth: 0.2, emissive: true })
  ]],
  [/heart|love/, 'Heart', (c) => [
    P('cylinder', 0, 0.6, 0, 0.12, 1.2, 0.12, '#94a3b8'),
    P('extrude', 0, 0, 0, 1, 1, 1, '#f43f5e', { outline: Array.from({ length: 24 }, (_, i) => { const t = i / 24 * Math.PI * 2; return [0.065 * 16 * Math.pow(Math.sin(t), 3), 2.0 + 0.065 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; }), depth: 0.25 })
  ]],
  [/mountain|peak|ridge|summit|volcano/, 'Mountain', (c) => [
    P('cone', 0, 1.0, 0, 2.4, 2.0, 2.4, '#6f7a8f'),
    P('cone', 0.9, 0.7, 0.4, 1.4, 1.4, 1.4, '#58627a'),
    P('cone', 0, 1.75, 0, 0.9, 0.55, 0.9, '#f8fafc')
  ]],
  [/wave|ripple|lake|water|river|stream/, 'Wave', (c) => [
    P('tube', 0, 0, 0, 1, 1, 1, '#38bdf8', { path: [[-2, 0.4, 0], [-1, 1.2, 0], [0, 0.4, 0], [1, 1.2, 0], [1.6, 1.6, 0], [1.2, 2.0, 0]], radius: 0.25 }),
    P('tube', 0, 0, 0, 1, 1, 1, '#bae6fd', { path: [[-2, 0.3, 0.5], [-1, 0.9, 0.5], [0, 0.3, 0.5], [1, 0.9, 0.5]], radius: 0.15 })
  ]],
  [/cloud|storm|fog/, 'Cloud', (c) => [
    P('cylinder', 0, 0.9, 0, 0.1, 1.8, 0.1, '#94a3b8'),
    P('sphere', 0, 2.4, 0, 1.2, 0.8, 0.9, '#f8fafc'),
    P('sphere', 0.8, 2.2, 0, 0.9, 0.6, 0.7, '#f8fafc'),
    P('sphere', -0.8, 2.25, 0, 0.9, 0.6, 0.7, '#f8fafc')
  ]],
  [/windmill|wind\b|turbine|pinwheel/, 'Windmill', (c) => [
    P('cylinder', 0, 1.4, 0, 0.6, 2.8, 0.6, c.main),
    ...[0, 1, 2, 3].map(i => P('box', Math.cos(i * Math.PI / 2) * 0.7, 2.9 + Math.sin(i * Math.PI / 2) * 0.7, 0.35, 0.2, 1.3, 0.04, c.accent, { rz: i * Math.PI / 2 + Math.PI / 2 })),
    P('sphere', 0, 2.9, 0.35, 0.18, 0.18, 0.18, '#475569')
  ]],
  [/kite/, 'Kite', (c) => [
    P('cylinder', 0, 1.0, 0, 0.05, 2.0, 0.05, '#e2e8f0'),
    P('extrude', 0, 0, 0, 1, 1, 1, c.main, { outline: [[0, 3.6], [0.7, 2.7], [0, 1.9], [-0.7, 2.7]], depth: 0.04 }),
    P('tube', 0, 0, 0, 1, 1, 1, c.accent, { path: [[0, 1.9, 0], [0.3, 1.5, 0], [-0.2, 1.1, 0], [0.2, 0.7, 0]], radius: 0.03 })
  ]],
  [/train|rail|locomotive|railway/, 'Locomotive', (c) => [
    P('box', -0.3, 0.75, 0, 1.6, 0.8, 0.9, c.main),
    P('cylinder', 0.7, 0.75, 0, 0.8, 1.0, 0.8, c.main, { rz: Math.PI / 2 }),
    P('cylinder', 0.9, 1.5, 0, 0.3, 0.6, 0.3, '#1f2937'),
    P('box', -0.8, 1.45, 0, 0.7, 0.7, 0.9, c.accent),
    ...[-0.7, 0, 0.7].map(x => P('cylinder', x, 0.3, 0.48, 0.55, 0.12, 0.55, '#1f2937', { rx: Math.PI / 2 })),
    ...[-0.7, 0, 0.7].map(x => P('cylinder', x, 0.3, -0.48, 0.55, 0.12, 0.55, '#1f2937', { rx: Math.PI / 2 }))
  ]],
  [/bench|chair|seat/, 'Bench', (c) => [
    P('box', 0, 0.55, 0, 2.2, 0.12, 0.6, c.main),
    P('box', 0, 1.0, -0.28, 2.2, 0.6, 0.08, c.main),
    P('box', -0.9, 0.27, 0, 0.12, 0.55, 0.5, '#334155'),
    P('box', 0.9, 0.27, 0, 0.12, 0.55, 0.5, '#334155')
  ]],
  [/table|desk/, 'Table', (c) => [
    P('box', 0, 0.9, 0, 1.8, 0.12, 1.1, c.main),
    ...[[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]].map(([x, z]) => P('cylinder', x, 0.45, z, 0.12, 0.9, 0.12, '#334155'))
  ]],
  [/lamp|lantern|light|candle/, 'Lantern', (c) => [
    P('cylinder', 0, 1.0, 0, 0.12, 2.0, 0.12, '#334155'),
    P('box', 0, 2.3, 0, 0.6, 0.7, 0.6, '#fef08a', { emissive: true }),
    P('cone', 0, 2.85, 0, 0.55, 0.4, 0.55, '#334155', { ry: Math.PI / 4 })
  ]],
  [/snowman|snow/, 'Snowman', (c) => [
    P('sphere', 0, 0.6, 0, 1.2, 1.2, 1.2, '#f8fafc'),
    P('sphere', 0, 1.55, 0, 0.85, 0.85, 0.85, '#f8fafc'),
    P('sphere', 0, 2.25, 0, 0.6, 0.6, 0.6, '#f8fafc'),
    P('cone', 0, 2.25, 0.35, 0.08, 0.35, 0.08, '#f97316', { rx: Math.PI / 2 }),
    P('cylinder', 0, 2.65, 0, 0.5, 0.35, 0.5, '#1f2937')
  ]],
  [/beetle|bug|insect|ladybug|ant\b/, 'Beetle', (c) => [
    P('sphere', 0, 0.55, 0, 1.4, 0.7, 1.0, c.main),
    P('sphere', 0.75, 0.55, 0, 0.45, 0.4, 0.45, '#1f2937'),
    P('box', 0, 0.85, 0, 1.3, 0.04, 0.04, '#1f2937'),
    ...[-0.4, 0, 0.4].flatMap(x => [P('cylinder', x, 0.25, 0.5, 0.05, 0.5, 0.05, '#1f2937', { rx: 0.6 }), P('cylinder', x, 0.25, -0.5, 0.05, 0.5, 0.05, '#1f2937', { rx: -0.6 })])
  ]],
  [/gear|cog|clock|machine/, 'Gear', (c) => [
    P('cylinder', 0, 0.9, 0, 0.12, 1.8, 0.12, '#94a3b8'),
    P('torus', 0, 2.4, 0, 1.6, 0.6, 1.6, c.main, { spin: true }),
    ...Array.from({ length: 10 }, (_, i) => P('box', Math.cos(i / 10 * Math.PI * 2) * 0.95, 2.4 + Math.sin(i / 10 * Math.PI * 2) * 0.95, 0, 0.25, 0.25, 0.2, c.main)),
    P('cylinder', 0, 2.4, 0, 0.4, 0.25, 0.4, c.accent, { rx: Math.PI / 2 })
  ]],
  [/dome|igloo|planetarium/, 'Dome', (c) => [
    P('lathe', 0, 0, 0, 1, 1, 1, c.main, { profile: Array.from({ length: 8 }, (_, i) => { const a = i / 7 * Math.PI / 2; return [Math.cos(a) * 1.6, Math.sin(a) * 1.6]; }) }),
    P('torus', 0, 0.05, 0, 3.2, 0.4, 3.2, c.accent, { rx: Math.PI / 2 })
  ]],
  [/goat|sheep|deer|horse|dog|cat|bear|animal/, 'Animal', (c) => [
    P('box', 0, 1.0, 0, 1.6, 0.8, 0.7, c.main),
    P('box', 0.95, 1.5, 0, 0.55, 0.5, 0.45, c.main),
    P('cone', 0.95, 1.9, 0.15, 0.08, 0.3, 0.08, c.accent),
    P('cone', 0.95, 1.9, -0.15, 0.08, 0.3, 0.08, c.accent),
    ...[[-0.6, 0.25], [-0.6, -0.25], [0.6, 0.25], [0.6, -0.25]].map(([x, z]) => P('cylinder', x, 0.3, z, 0.15, 0.6, 0.15, '#475569'))
  ]],
  [/music|song|note|guitar|piano|melody/, 'Music Note', (c) => [
    P('sphere', -0.3, 1.0, 0, 0.6, 0.45, 0.4, c.main, { rz: 0.4 }),
    P('cylinder', -0.05, 2.0, 0, 0.12, 2.0, 0.12, c.main),
    P('extrude', 0, 0, 0, 1, 1, 1, c.main, { outline: [[-0.05, 3.0], [0.7, 2.6], [0.7, 2.3], [-0.05, 2.7]], depth: 0.12 })
  ]],
  [/book|story|poem|journal|diary/, 'Open Book', (c) => [
    P('box', -0.55, 1.0, 0, 1.0, 0.06, 1.3, '#fef3c7', { rz: 0.15 }),
    P('box', 0.55, 1.0, 0, 1.0, 0.06, 1.3, '#fef3c7', { rz: -0.15 }),
    P('box', 0, 0.95, 0, 2.2, 0.05, 1.4, c.main),
    P('cylinder', 0, 0.45, 0, 0.15, 0.9, 0.15, '#334155')
  ]]
];

// Find a recognisable form for whatever the text describes; null if nothing fits
function formForText(text, palette = {}) {
      const lower = String(text || '').toLowerCase();
      // Whole words only (plurals allowed), so "architecture" isn't an "arch" and "start" isn't a "star"
      const found = SUBJECT_FORMS.find(([re]) => new RegExp(`\\b(?:${re.source})(?:e?s)?\\b`).test(lower));
      if (!found) return null;
      const colors = { main: palette.main || randomHex(), accent: palette.accent || randomHex() };
      return { name: found[1], parts: sanitizeParts(found[2](colors)) };
    }

// With an AI brain, design the exact thing he means when nothing else describes it
async function designCreationWithAI(title) {
      if (!hasLLMKey()) return null;
      const prompt = `Design a 3D welded sculpture that clearly looks like: "${title}".
Return ONLY JSON: {"parts": [ ... ]} with 3 to 20 parts. It must be recognisable as that subject (correct proportions, distinctive features, sensible colours).
Each part: "shape" (cylinder, box, sphere, cone, torus, knot, octahedron, dodecahedron, icosahedron, tetrahedron, ring, lathe, extrude, tube),
"x","y","z" (y is height, it stands on y=0, keep within -2.5..2.5 and 0..5), "rx","ry","rz", "color" "#rrggbb",
sizes "sx","sy","sz" for basic shapes; lathe uses "profile":[[radius,height],...]; extrude uses "outline":[[x,y],...] and "depth"; tube uses "path":[[x,y,z],...] and "radius".`;
      const parsed = await callLLMJSON([{ text: prompt }]);
      return parsed ? sanitizeParts(parsed.parts) : null;
    }
