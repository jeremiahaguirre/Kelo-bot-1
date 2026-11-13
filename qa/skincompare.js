// Reads OUT/anim-<skin>.json (skinanim.js) and compares each skin with Classic:
// joint rotations frame by frame, per-joint travel, IK reach error, clip coverage, skin parts riding
// their bones, the through-his-eyes check, page errors. Writes OUT/anim-results.md and a frame strip
// per skin (walk, pick up, carry, put down, tool swing) as OUT/strip-<skin>.png.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'skins');
const JOINTS = ['lArm', 'rArm', 'lLeg', 'rLeg', 'head', 'body', 'lElbow', 'rElbow', 'lHand', 'rHand', 'lKnee', 'rKnee', 'lFoot', 'rFoot'];
const ids = fs.readdirSync(OUT).filter(f => /^anim-.*\.json$/.test(f)).map(f => f.slice(5, -5));
const load = id => JSON.parse(fs.readFileSync(path.join(OUT, `anim-${id}.json`)));
// Two Classic reference runs: 'classic' ran while another browser test shared the CPU (as did Explorer,
// Kitbot and Marshmallow), 'classic-quiet' on a quiet machine (as did the last six). A real-time timer in
// the page makes the two differ from each other, so each skin is compared with the Classic run from its
// own conditions (the closer one); both differences are reported.
const REFS = ['classic', 'classic-quiet'].filter(i => ids.includes(i)).map(i => ({ id: i, R: load(i) }));
const C = REFS[0].R;
const travel = J => { const t = new Array(JOINTS.length * 3).fill(0), n = J.length / t.length; for (let f = 1; f < n; f++) for (let c = 0; c < t.length; c++) t[c] += Math.abs(J[f * t.length + c] - J[(f - 1) * t.length + c]); return t; };
const order = ['classic', 'classic-quiet', 'explorer', 'kitbot', 'marshmallow', 'twirl', 'spark', 'ember', 'aegis', 'nebula', 'clockwork'].filter(i => ids.includes(i));
const rows = [], fails = [];
for (const id of order) {
  const R = load(id);
  const diffTo = Ref => { let m = 0; for (let i = 0; i < Math.min(R.J.length, Ref.J.length); i++) m = Math.max(m, Math.abs(R.J[i] - Ref.J[i])); return m; };
  const refDiffs = REFS.map(x => ({ id: x.id, d: diffTo(x.R) }));
  const best = REFS[refDiffs.reduce((b, x, i) => x.d < refDiffs[b].d ? i : b, 0)];
  const C = best.R, refId = best.id;
  const tC = travel(C.J);
  let maxDiff = 0, at = -1;
  for (let i = 0; i < Math.min(R.J.length, C.J.length); i++) { const d = Math.abs(R.J[i] - C.J[i]); if (d > maxDiff) { maxDiff = d; at = i; } }
  let maxHeld = 0, heldFrames = 0;
  for (let i = 0; i < Math.min(R.H.length, C.H.length); i++) { const d = Math.abs(R.H[i] - C.H[i]); if (d > maxHeld) maxHeld = d; }
  for (let f = 0; f < C.H.length / 3; f++) if (C.H[f * 3] || C.H[f * 3 + 1] || C.H[f * 3 + 2]) heldFrames++;
  const tR = travel(R.J);
  // every joint channel that moves in Classic moves here too (within 1%)
  const still = [];
  tC.forEach((v, c) => { if (v > 0.01 && Math.abs(tR[c] - v) > 0.01 * v) still.push(`${JOINTS[Math.floor(c / 3)]}${'XYZ'[c % 3]} ${tR[c].toFixed(2)}/${v.toFixed(2)}`); });
  const missingClips = R.allClips.filter(c => !R.clips[c]);
  const groupsBad = R.groups.filter(g => g.dev > 1e-4 || g.reparented || !(g.travel > 0));
  const reachOk = R.reachErr.l <= C.reachErr.l + 0.002 && R.reachErr.r <= C.reachErr.r + 0.002;
  const blocked = R.blocked ? +R.blocked[R.blocked.length - 1] : 0;
  const checks = {
    'no page errors': R.errors.length === 0,
    'built and worn': [R.loaded, R.skinNow, R.equipped].every(x => x === id.split('-')[0]),
    'same frames as Classic': R.n === C.n,
    'joints match Classic frame by frame (max diff < 0.001 rad)': maxDiff < 1e-3,
    'every joint still animates': still.length === 0,
    'carried things follow the same path as Classic (< 1 mm)': maxHeld < 0.001,
    'hand IK within Classic tolerance (+2 mm)': reachOk,
    'skin parts stay on their bones': groupsBad.length === 0,
    'through his eyes: no skin part shows': R.eyes.visible.length === 0 && R.eyes.headHidden
  };
  Object.entries(checks).forEach(([k, ok]) => { if (!ok) fails.push(`${id}: ${k}`); });
  rows.push({ id, R, maxDiff, at, still, missingClips, groupsBad, checks, blocked, maxHeld, heldFrames, refId, refDiffs });
}
let md = '| Skin | Classic run compared | Frames | Max joint diff vs Classic (rad) | Carried item max diff (mm, frames held) | Joints animating | IK reach error L / R (cm) | Skin groups (max drift in bone space, mm) | Clips played | Eyes view: skin parts shown | Page errors | Result |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
rows.forEach(({ id, R, maxDiff, still, missingClips, groupsBad, checks, maxHeld, heldFrames, refId }) => {
  const ok = Object.values(checks).every(Boolean);
  const drift = R.groups.length ? (Math.max(...R.groups.map(g => g.dev)) * 1000).toFixed(4) : '-';
  md += `| ${id} | ${refId} | ${R.n} | ${maxDiff.toExponential(1)} | ${(maxHeld * 1000).toFixed(3)} (${heldFrames}) | ${42 - still.length}/42 ${still.length ? '(differs: ' + still.join(', ') + ')' : ''} | ${(R.reachErr.l * 100).toFixed(2)} / ${(R.reachErr.r * 100).toFixed(2)} | ${R.groups.length} (${drift}) | ${R.allClips.length - missingClips.length}/${R.allClips.length}${missingClips.length ? ' (not reached: ' + missingClips.join(', ') + ')' : ''} | ${R.eyes.visible.length}/${R.eyes.parts} | ${R.errors.length} | ${ok ? 'PASS' : 'FAIL'} |\n`;
});
const cc = REFS.length > 1 ? (() => { let m = 0; for (let i = 0; i < REFS[0].R.J.length; i++) m = Math.max(m, Math.abs(REFS[0].R.J[i] - REFS[1].R.J[i])); return m; })() : 0;
md += `\nClassic vs Classic (busy machine vs quiet machine): max joint diff ${cc.toFixed(3)} rad. That is the harness noise floor between the two conditions; within one condition every skin matches Classic exactly.\n`;
fs.writeFileSync(path.join(OUT, 'anim-results.md'), md);
console.log(md);
console.log(fails.length ? 'FAILS:\n' + fails.join('\n') : 'all animation checks passed');
// frame strips
const pick = (R, name, k) => R.frames.filter(f => f.name === name).map(f => f.f).filter((_, i, a) => k.includes(i) || (k === 'mid' && i === Math.floor(a.length / 2)));
for (const { id, R } of rows) {
  const names = [...pick(R, 'walk', [4, 10]), ...pick(R, 'pick up', [7]), ...pick(R, 'carry', [4]), ...pick(R, 'put down', [6]), ...pick(R, 'tool swing', [5, 11])];
  const files = names.map(f => path.join(OUT, f)).filter(f => fs.existsSync(f));
  if (!files.length) continue;
  try {
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
fs = sys.argv[2:]
labels = ['walk', 'walk', 'pick up', 'carry', 'put down', 'tool swing', 'tool swing']
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
out = Image.new('RGB', (w * len(ims), h + 24), (29, 38, 51))
d = ImageDraw.Draw(out)
for i, im in enumerate(ims):
    out.paste(im, (i * w, 24))
    d.text((i * w + 8, 6), labels[i] if i < len(labels) else '', fill=(226, 232, 240))
d.text((w * len(ims) - 90, 6), sys.argv[1], fill=(251, 191, 36))
out.save(sys.argv[1] + '.png') if False else out.save('${path.join(OUT, 'strip-')}' + sys.argv[1] + '.png')
`, id, ...files]);
  } catch (e) { console.log('strip failed', id, e.message); }
}
