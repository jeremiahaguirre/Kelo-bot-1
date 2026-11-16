// Compares two skinanim.js runs (e.g. r128 vs r187): every joint channel frame by frame, the carried
// item path, clips played, IK reach, eyes view. Usage: node animdiff.js <dirA> <dirB> skin...
const fs = require('fs'), path = require('path');
const [A, B, ...skins] = process.argv.slice(2);
const flat = x => Array.isArray(x) ? x.flatMap(flat) : (x && typeof x === 'object' ? Object.values(x).flatMap(flat) : [x]);
for (const s of skins) {
  const a = JSON.parse(fs.readFileSync(path.join(A, `anim-${s}.json`))), b = JSON.parse(fs.readFileSync(path.join(B, `anim-${s}.json`)));
  const ja = flat(a.J), jb = flat(b.J), ha = flat(a.H), hb = flat(b.H);
  let dj = 0, dh = 0;
  for (let i = 0; i < Math.min(ja.length, jb.length); i++) if (typeof ja[i] === 'number') dj = Math.max(dj, Math.abs(ja[i] - jb[i]));
  for (let i = 0; i < Math.min(ha.length, hb.length); i++) if (typeof ha[i] === 'number' && typeof hb[i] === 'number') dh = Math.max(dh, Math.abs(ha[i] - hb[i]));
  const ca = Object.keys(a.clips || {}), cb = Object.keys(b.clips || {});
  console.log(JSON.stringify({ skin: s, frames: [a.n, b.n], jointValues: [ja.length, jb.length], maxJointDiff: dj, maxHeldDiff: dh,
    clips: [ca.length, cb.length], clipsOnlyIn: { a: ca.filter(c => !cb.includes(c)), b: cb.filter(c => !ca.includes(c)) },
    reach: [a.reachErr, b.reachErr], walked: [a.walked, b.walked], eyesVisible: [a.eyes.visible.length, b.eyes.visible.length], errors: [a.errors.length, b.errors.length] }));
}
