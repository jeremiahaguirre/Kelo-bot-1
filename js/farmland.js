// Kelo-bot-1 — js/farmland.js
// Loaded after farmdata.js. The farm's land: where it is (chosen and surveyed by him, never in town,
// never in water, never on the runway field or the north yard, checked with the shared offLimits
// helper), the ground (graded flat in a sweep, drained by ditches, a lane cut down from Yard Street),
// its 3D ground mesh with the old meshes sunk under it, the wild trees and stones he clears, the
// fence and gates, the farm roads, and how he walks and drives there (paths on the farm).
//
// Coordinates: the site is a world rectangle; farm-local metres (xm east from the west fence, dm
// north from the south fence) map with farmWorld(xm, dm). North is -z. 1.6 units = 1 m.

// The places he looks at (both outside the world bounds of the valley, on the far lands). Each is
// ~200 m x 219 m. He surveys each (earthwork, distance to a road, the land rules) and picks one.
const FARM_SITE_CANDIDATES = [
  { id: 'east', name: 'the east benchland past the north yard', minX: 180, maxX: 500, minZ: -462, maxZ: -112 },
  { id: 'west', name: 'the west benchland past the runway field', minX: -500, maxX: -180, minZ: -462, maxZ: -112 }
];
const FARM_Y = 6;            // the lowest level he would grade to (each site's own level is chosen by the survey: farmSiteY)
const FARM_BLEND = 30;       // the cut and fill banks round it
const FARM_GATE_DM = 10;     // the gate and the farm lane: 10 m in from the south fence
const FARM_FIELD_ROAD_XM = 74;
const FARM_STEAD = { x0: 0, x1: 72, d0: 0, d1: 100 };   // the farmyard (house, barn, shed, bins)
const FARM_FIELDS_LAYOUT = [
  { id: 'f1', name: 'South field', x0: 78, x1: 196, d0: 6, d1: 72 },
  { id: 'f2', name: 'Middle field', x0: 78, x1: 196, d0: 76, d1: 142 },
  { id: 'f3', name: 'North field', x0: 78, x1: 196, d0: 146, d1: 212 }
];
// The lane from the end of Yard Street (js/roads.js) to the gate (east site); the west site's lane
// comes from the west end of Yard Street
function farmLanePoints() {
      const S = farmSite();
      if (!S) return [];
      const gz = S.maxZ - FARM_GATE_DM * FARM_U;
      if (S.id === 'west') return [[18, -106], [-6, -110], [-60, -118], [-120, -124], [S.maxX, gz]];
      return [[106, -106], [126, -108], [152, -117], [S.minX, gz]];
    }

// The level a site is graded to: its own (cut balanced against fill), from the survey
function farmSiteY() { const S = farmSite(); return S && Number.isFinite(S.y) ? S.y : FARM_Y; }
function farmSite() { return (typeof state !== 'undefined' && state.farm && state.farm.site) || null; }
function farmWorld(xm, dm) {
      const S = farmSite() || FARM_SITE_CANDIDATES[0];
      // The west site is a mirror: its gate is on its east fence, so x runs west from there
      return S.id === 'west' ? { x: S.maxX - xm * FARM_U, z: S.maxZ - dm * FARM_U } : { x: S.minX + xm * FARM_U, z: S.maxZ - dm * FARM_U };
    }
function farmLocalOf(x, z) {
      const S = farmSite() || FARM_SITE_CANDIDATES[0];
      return { xm: (S.id === 'west' ? S.maxX - x : x - S.minX) / FARM_U, dm: (S.maxZ - z) / FARM_U };
    }
// A building's world rectangle (centre, half sizes in units)
function farmBuildingRect(key) {
      const B = FARM_BUILDINGS[key];
      const c = farmWorld(B.at[0], B.at[1]);
      return { x: c.x, z: c.z, hw: B.w * FARM_U / 2, hd: B.d * FARM_U / 2, w: B.w * FARM_U, d: B.d * FARM_U };
    }
function farmFieldRect(L) {
      const a = farmWorld(L.x0, L.d0), b = farmWorld(L.x1, L.d1);
      return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
    }

function farmInSite(x, z, pad = 0) {
      const S = farmSite();
      return Boolean(S && x > S.minX - pad && x < S.maxX + pad && z > S.minZ - pad && z < S.maxZ + pad);
    }
// The lane: distance from its centre line and how far along it (units)
function farmLaneProbe(x, z) {
      const P = farmLanePoints();
      let best = { d: 1e9, s: 0 }, run = 0;
      for (let i = 1; i < P.length; i++) {
        const [ax, az] = P[i - 1], [bx, bz] = P[i];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (d < best.d) best = { d, s: run + t * L };
        run += L;
      }
      best.len = run;
      return best;
    }
function farmLaneLength() { return farmLaneProbe(0, 0).len; }
// Anywhere the farm changes the land: the site with its banks, and the lane
function farmInArea(x, z, pad = 0) {
      const S = farmSite();
      if (!S) return false;
      if (farmInSite(x, z, FARM_BLEND + pad)) return true;
      const P = farmLanePoints(), xs = P.map(p => p[0]), zs = P.map(p => p[1]);
      if (x < Math.min(...xs) - 14 - pad || x > Math.max(...xs) + 14 + pad || z < Math.min(...zs) - 14 - pad || z > Math.max(...zs) + 14 + pad) return false;
      return farmLaneProbe(x, z).d < 14 + pad;
    }

// --- The ground ---------------------------------------------------------------------------------
const farmSmooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// Graded weight at (x, z): the grading sweeps from the south fence north as land.graded goes 0 -> 1
function farmGradeWeight(S, x, z, graded) {
      if (graded <= 0) return 0;
      const depth = S.maxZ - S.minZ + 2 * FARM_BLEND;
      const front = S.maxZ + FARM_BLEND + 12 - (depth + 24) * graded;
      return farmSmooth((z - front) / 24 + 0.5);
    }
// The bank weight: 1 inside the site, easing to 0 over FARM_BLEND outside it
function farmEdgeWeight(S, x, z) {
      const dx = Math.max(0, S.minX - x, x - S.maxX), dz = Math.max(0, S.minZ - z, z - S.maxZ);
      return 1 - farmSmooth(Math.hypot(dx, dz) / FARM_BLEND);
    }
// The drainage ditches: 3 m in from the fence on all four sides (the culvert carries the lane over the
// west one at the gate), 0.6 m deep at the middle when finished
function farmDitchDepth(S, x, z, drained) {
      if (drained <= 0 || !farmInSite(x, z)) return 0;
      const inX = Math.min(x - S.minX, S.maxX - x), inZ = Math.min(z - S.minZ, S.maxZ - z), e = Math.min(inX, inZ);
      const c = 3 * FARM_U, half = 1.2 * FARM_U;
      const k = 1 - Math.min(1, Math.abs(e - c) / half);
      if (k <= 0) return 0;
      // (no ditch under the lane where it crosses at the gate: the culvert)
      const gate = farmWorld(0, FARM_GATE_DM);
      if (Math.hypot(x - gate.x, z - gate.z) < 6) return 0;
      return 0.6 * FARM_U * k * k * (3 - 2 * k) * Math.min(1, drained * 1.05);
    }
// What the farm makes of the ground at (x, z) on top of everything else (js/scene.js
// groundAboveNatural -> workshopPadAt); cheap when far away
function farmLandAt(x, z, base) {
      const S = farmSite();
      if (!S) return base;
      const F = state.farm.land;
      let h = base;
      // The lane, graded from the yard's level up to the farm's as it is built (land.lane 0..1)
      if (F.lane > 0 && z > -142 && z < -90) {
        const L = farmLaneProbe(x, z);
        if (L.d < 14) {
          const start = S.id === 'west' ? 0 : 18;   // the first stretch is already the yard
          const t = farmSmooth((L.s - start) / Math.max(1, L.len - start));
          const y = 0.05 + (farmSiteY() - 0.05) * t;
          const built = farmSmooth((F.lane * (L.len + 10) - L.s) / 10);
          const w = (1 - farmSmooth((L.d - 3) / 10)) * built * farmSmooth((L.s - start + 4) / 8);
          h = h + (y - h) * w;
        }
      }
      if (x < S.minX - FARM_BLEND || x > S.maxX + FARM_BLEND || z < S.minZ - FARM_BLEND || z > S.maxZ + FARM_BLEND) return h;
      const w = farmGradeWeight(S, x, z, F.graded) * farmEdgeWeight(S, x, z);
      if (w > 0) {
        const swell = 0.18 * Math.sin(x * 0.019 + 1.1) * Math.cos(z * 0.017);
        h = h + (farmSiteY() + swell - h) * w;
      }
      return h - farmDitchDepth(S, x, z, F.drained);
    }
if (typeof workshopPadAt === 'function') {
  const farmOrigPadAt = workshopPadAt;
  workshopPadAt = function (x, z, natural) { return farmLandAt(x, z, farmOrigPadAt(x, z, natural)); };
}

// --- The land rules: the site picked with the shared helpers --------------------------------------
// Problems with a candidate rectangle: town, water, the runway field, the Workshop's land, roads,
// buildings (offLimits, inTown, WATER_LEVEL), sampled every 8 m
function farmSiteProblems(R) {
      const issues = new Set();
      // (the site itself; its banks may meet the runway field's own banks)
      for (let x = R.minX; x <= R.maxX; x += 12.8) for (let z = R.minZ; z <= R.maxZ; z += 12.8) {
        if (typeof inTown === 'function' && inTown(x, z)) issues.add('town');
        if (z > -20 && getAnalyticalGroundHeight(x, z) < WATER_LEVEL + 0.1) issues.add('water');
        if (typeof onRunwayReserve === 'function' && onRunwayReserve(x, z, RUNWAY_FIELD.blend)) issues.add('the runway field');
        if (typeof inWorkshopSite === 'function' && inWorkshopSite(x, z, 4)) issues.add('the Workshop\'s north yard');
        const off = typeof farmOrigOffLimits === 'function' ? farmOrigOffLimits(x, z) : null;
        if (off && !/runway/i.test(off)) issues.add(off);
      }
      return [...issues];
    }
// Survey a candidate: earth to move (m³, cut + fill to the farm's level), the steepest ground, the
// distance to the nearest road; problems first
function farmSurveySite(R) {
      let steep = 0, mn = 1e9, mx = -1e9;
      const cell = 16, ys = [];
      for (let x = R.minX + cell / 2; x < R.maxX; x += cell) for (let z = R.minZ + cell / 2; z < R.maxZ; z += cell) {
        const y = getAnalyticalGroundHeight(x, z);
        ys.push(y); mn = Math.min(mn, y); mx = Math.max(mx, y);
        steep = Math.max(steep, Math.abs(getAnalyticalGroundHeight(x + 4, z) - y) / 4);
      }
      // The level that balances the cut against the fill (the mean), never below FARM_Y
      const level = Math.max(FARM_Y, Math.round(ys.reduce((s, y) => s + y, 0) / ys.length * 10) / 10);
      let cut = 0, fill = 0;
      const a = (cell / FARM_U) ** 2;
      ys.forEach(y => { const dy = (y - level) / FARM_U; if (dy > 0) cut += dy * a; else fill -= dy * a; });
      const lane = R.id === 'west' ? Math.hypot(R.maxX - 18, -128 + 106) : Math.hypot(R.minX - 106, -128 + 106);
      const problems = farmSiteProblems(R);
      const ha = farmHa(R.maxX - R.minX, R.maxZ - R.minZ);
      // the lane has to climb from the yard (y 0.05) to the farm's level: steeper than 1 in 8 is no good for a loaded truck
      const climb = (level - 0.05) / Math.max(1, lane);
      if (climb > 0.3) problems.push('too steep a climb for the lane');
      return { id: R.id, name: R.name, y: level, ha: Math.round(ha * 10) / 10, cutM3: Math.round(cut), fillM3: Math.round(fill), reliefM: Math.round((mx - mn) / FARM_U), steep: Math.round(steep * 100) / 100,
        laneM: Math.round(lane / FARM_U), climb: Math.round(climb * 100) / 100, problems, score: problems.length ? -1 : 1e7 / (cut + fill + 1) - lane / FARM_U * 2 };
    }

// --- Keeping other jobs off it (the shared gate, js/landscape.js) ----------------------------------
let farmJobActive = false;
const farmOrigOffLimits = typeof offLimits === 'function' ? offLimits : null;
if (farmOrigOffLimits) offLimits = function (x, z, pad = 0) {
  if (!farmJobActive && farmInArea(x, z, pad)) return 'my farm';
  return farmOrigOffLimits(x, z, pad);
};
// The lane and the farm roads are roads to his vehicles (js/trips.js terrain rules)
if (typeof tripOnRoad === 'function') {
  const farmOrigTripOnRoad = tripOnRoad;
  tripOnRoad = function (x, z) { return farmOnRoad(x, z) || farmOrigTripOnRoad(x, z); };
}
function farmOnRoad(x, z) {
      const S = farmSite();
      if (!S || !state.farm.land.lane) return false;
      if (farmLaneProbe(x, z).d < 3.5) return true;
      if (!farmInSite(x, z)) return false;
      const l = farmLocalOf(x, z);
      return (Math.abs(l.dm - FARM_GATE_DM) < 2.5 && l.xm < FARM_FIELD_ROAD_XM + 2) || (Math.abs(l.xm - FARM_FIELD_ROAD_XM) < 2.5) || (l.xm < FARM_STEAD.x1 && l.dm < FARM_STEAD.d1);
    }
// The camera may go there
if (typeof EXPLORE_BOUNDS !== 'undefined') { EXPLORE_BOUNDS.maxX = Math.max(EXPLORE_BOUNDS.maxX, 560); EXPLORE_BOUNDS.minX = Math.min(EXPLORE_BOUNDS.minX, -560); }

// --- Paths on the farm ----------------------------------------------------------------------------
// The valley's A* grid ends at the north yard; past it js/scene.js findPath walks straight legs from
// the grid's edge. To and from the farm he goes by the lane, and on the farm by its own small grid
// (2-unit cells) round the buildings, bins and parked machines.
const farmPathGrid = { sig: '', cols: 0, rows: 0, x0: 0, z0: 0, cell: 2, blocked: null };
function farmPathBlocked() {
      const S = farmSite(), G = farmPathGrid;
      const sig = `${S.id}|${typeof obstacleSignature === 'function' ? obstacleSignature() : worldObstacles.length}`;
      if (G.sig === sig && G.blocked) return G;
      G.x0 = S.minX - 6; G.z0 = S.minZ - 6; G.cols = Math.ceil((S.maxX - S.minX + 12) / G.cell); G.rows = Math.ceil((S.maxZ - S.minZ + 12) / G.cell);
      G.blocked = new Uint8Array(G.cols * G.rows);
      const obs = worldObstacles.filter(o => farmInSite(o.x, o.z, 40));
      for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
        const x = G.x0 + (c + 0.5) * G.cell, z = G.z0 + (r + 0.5) * G.cell;
        // the fence: only the gate is open (once the fence is up)
        if (!farmInSite(x, z, -0.5) && state.farm.land.fenced > 0.99 && !farmNearGate(x, z)) { G.blocked[r * G.cols + c] = 1; continue; }
        for (const o of obs) if (obstacleProbe(o, x, z).d < KELO_RADIUS + 0.3) { G.blocked[r * G.cols + c] = 1; break; }
      }
      G.sig = sig;
      return G;
    }
function farmNearGate(x, z) { const g = farmWorld(0, FARM_GATE_DM); return Math.hypot(x - g.x, z - g.z) < 7; }
function farmGridPath(from, to) {
      const G = farmPathBlocked(), C = G.cols, R = G.rows;
      const col = x => Math.max(0, Math.min(C - 1, Math.floor((x - G.x0) / G.cell))), row = z => Math.max(0, Math.min(R - 1, Math.floor((z - G.z0) / G.cell)));
      const cx = c => G.x0 + (c + 0.5) * G.cell, cz = r => G.z0 + (r + 0.5) * G.cell;
      const start = row(from.z) * C + col(from.x), goal = row(to.z) * C + col(to.x);
      const blocked = G.blocked.slice();
      blocked[start] = 0; blocked[goal] = 0;
      const N = C * R, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const hF = [], hI = [];
      const push = (f, i) => { let k = hF.length; hF.push(f); hI.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hF[p] <= f) break; hF[k] = hF[p]; hI[k] = hI[p]; k = p; } hF[k] = f; hI[k] = i; };
      const pop = () => { const top = hI[0], lf = hF.pop(), li = hI.pop(); if (hF.length) { let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k, mf = lf; if (a < hF.length && hF[a] < mf) { m = a; mf = hF[a]; } if (b < hF.length && hF[b] < mf) m = b; if (m === k) break; hF[k] = hF[m]; hI[k] = hI[m]; k = m; } hF[k] = lf; hI[k] = li; } return top; };
      const h = i => Math.hypot(cx(i % C) - to.x, cz((i / C) | 0) - to.z);
      g[start] = 0; push(h(start), start);
      let found = false, it = 0;
      while (hF.length && it++ < 60000) {
        const i = pop();
        if (closed[i]) continue;
        closed[i] = 1;
        if (i === goal) { found = true; break; }
        const c = i % C, r = (i / C) | 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= C || nr >= R) continue;
          const j = nr * C + nc;
          if (blocked[j] || closed[j]) continue;
          if (dr && dc && (blocked[r * C + nc] || blocked[nr * C + c])) continue;
          const ng = g[i] + (dr && dc ? 1.414 : 1) * G.cell;
          if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + h(j), j); }
        }
      }
      if (!found) return [{ x: to.x, z: to.z }];
      const cells = [];
      for (let i = goal; i >= 0 && i !== start; i = came[i]) cells.push({ x: cx(i % C), z: cz((i / C) | 0) });
      cells.reverse();
      // String-pull: keep only the corners he can't see past
      const out = [];
      let a = from;
      for (let k = 0; k < cells.length; k++) {
        const nxt = cells[k + 1] || to;
        if (!segmentClear(a.x, a.z, nxt.x, nxt.z, to)) { out.push(cells[k]); a = cells[k]; }
      }
      out.push({ x: to.x, z: to.z });
      return out;
    }
function farmPathInside(from, to) {
      if (segmentClear(from.x, from.z, to.x, to.z, to) && !farmCrossesFence(from, to)) return [{ x: to.x, z: to.z }];
      return farmGridPath(from, to);
    }
function farmCrossesFence(a, b) {
      if (!(state.farm.land.fenced > 0.99)) return false;
      return farmInSite(a.x, a.z, -0.5) !== farmInSite(b.x, b.z, -0.5) && !farmNearGate(a.x, a.z) && !farmNearGate(b.x, b.z);
    }
// Is this point on the farm side of the lane (the farm, or past the north yard's grid on the lane)?
function farmPathRegion(p) {
      const S = farmSite();
      if (!S) return false;
      if (farmInSite(p.x, p.z, 4)) return true;
      const L = farmLaneProbe(p.x, p.z);
      return L.d < 16 && L.s > 22;
    }
if (typeof findPath === 'function') {
  const farmOrigFindPath = findPath;
  findPath = function (from, to) {
      if (!farmSite()) return farmOrigFindPath(from, to);
      const a = farmPathRegion(from), b = farmPathRegion(to);
      if (!a && !b) return farmOrigFindPath(from, to);
      const lane = farmLanePoints().map(([x, z]) => ({ x, z }));
      const gate = farmWorld(1.5, FARM_GATE_DM), inGate = farmWorld(5, FARM_GATE_DM);
      const laneOut = [...lane.slice(1, -1), { x: lane[lane.length - 1].x, z: lane[lane.length - 1].z }];
      // nearest lane point to a spot on the lane
      const fromLane = p => { let best = 0, bd = 1e9; lane.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = i; } }); return best; };
      if (a && b) {
        const ina = farmInSite(from.x, from.z, 2), inb = farmInSite(to.x, to.z, 2);
        if (ina && inb) { currentPathPartial = false; return farmPathInside(from, to); }
        if (!ina && !inb) return [{ x: to.x, z: to.z }];
        if (inb) { const i = fromLane(from); return [...lane.slice(i + 1).map(p => ({ ...p })), gate, ...farmPathInside(inGate, to)]; }
        const i = fromLane(to);
        return [...farmPathInside(from, inGate), gate, ...lane.slice(i).reverse().map(p => ({ ...p })), { x: to.x, z: to.z }];
      }
      if (b) {
        // valley -> farm: to the end of Yard Street on the valley's grid, then the lane and the gate
        const first = farmOrigFindPath(from, lane[0]);
        const tail = farmInSite(to.x, to.z, 2) ? [gate, ...farmPathInside(inGate, to)] : [{ x: to.x, z: to.z }];
        return [...first, ...laneOut.slice(0, -1), ...tail];
      }
      // farm -> valley
      const head = farmInSite(from.x, from.z, 2) ? [...farmPathInside(from, inGate), gate] : [];
      const rest = farmOrigFindPath(lane[0], to);
      return [...head, ...laneOut.slice(0, -1).reverse(), lane[0], ...rest];
    };
}

// --- 3D: the ground, the wild land, the lane, the fence ----------------------------------------------
// The farm's own ground mesh covers x 100..580 and z -560..-80 for the east site (lines of the far
// lands' grid, so where it stops both meshes are at true height) with 3-unit cells over the site and
// lane, coarser outside; the meshes under it (far lands, outer lands, north patch) are sunk there.
let farmGroundMesh = null, farmGroup = null, farmWildMeshes = null, farmFenceGroup = null, farmLaneMesh = null, farmStakeMesh = null;
const farmSunk = new WeakSet();
function farmCoverage() {
      const S = farmSite();
      return S.id === 'west' ? { minX: -580, maxX: -100, minZ: -560, maxZ: -80 } : { minX: 100, maxX: 580, minZ: -560, maxZ: -80 };
    }
function farmGroundLines(a, b, fine0, fine1) {
      const set = new Set([a, b]);
      for (let v = a; v < b; v += 20) set.add(Math.round(v));
      for (let v = Math.max(a, fine0); v <= Math.min(b, fine1); v += 3) set.add(Math.round(v * 10) / 10);
      return [...set].sort((p, q) => p - q);
    }
const farmGroundColours = {
      yard: new THREE.Color(0x8d8270), soil: new THREE.Color(0x6b5236), meadow: new THREE.Color(0x6f8f3c), ditch: new THREE.Color(0x4e5a34), lane: new THREE.Color(0x9a8f7c),
      cut: new THREE.Color(0x8a7458)
    };
function farmGroundColour(c, x, y, z) {
      const S = farmSite(), F = state.farm.land;
      if (typeof outerLandColour === 'function') outerLandColour(c, x, y, z); else c.setHex(0x5b7a32);
      // As the north patch draws the yard and its roads (js/scene.js buildNorthPatch3D)
      if (typeof keloRoadColour === 'function' && keloRoadColour(c, x, z)) return c;
      if (typeof inWorkshopSite === 'function' && inWorkshopSite(x, z) && y < 0.6) { c.setHex(0x8a8070); return c; }
      const w = farmGradeWeight(S, x, z, F.graded) * farmEdgeWeight(S, x, z);
      if (w > 0.02) {
        if (farmInSite(x, z)) {
          const l = farmLocalOf(x, z);
          const stead = l.xm < FARM_STEAD.x1 && l.dm < FARM_STEAD.d1;
          c.lerp(stead ? farmGroundColours.yard : farmGroundColours.meadow, w);
        } else c.lerp(farmGroundColours.cut, w * 0.8);
      }
      if (F.drained > 0 && farmDitchDepth(S, x, z, F.drained) > 0.25) c.lerp(farmGroundColours.ditch, 0.7);
      if (F.lane > 0 && farmOnRoad(x, z) && !farmInSite(x, z, -2)) c.lerp(farmGroundColours.lane, 0.85);
      return c;
    }
function farmSinkOldGround() {
      const C = farmCoverage(), m = 4;
      const meshes = [typeof farLandsMesh !== 'undefined' ? farLandsMesh : null, typeof northPatchMesh !== 'undefined' ? northPatchMesh : null, scene.getObjectByName('outerLands')].filter(Boolean);
      meshes.forEach(mesh => {
        if (farmSunk.has(mesh)) return;
        const pos = mesh.geometry.attributes.position;
        let n = 0;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) + mesh.position.x, z = pos.getZ(i) + mesh.position.z;
          if (!(x > C.minX && x < C.maxX && z > C.minZ && z < C.maxZ)) continue;
          // deep under it inside; just under its edge band, so no steep sliver pokes up through the seam
          const edge = Math.min(x - C.minX, C.maxX - x, z - C.minZ, C.maxZ - z);
          pos.setY(i, pos.getY(i) - (edge > m ? 80 : 0.5 * edge / m + 0.05)); n++;
        }
        if (n) { pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); }
        farmSunk.add(mesh);
      });
      // The distant firs inside it (js/realism.js buildDistantForest): the farm draws its own wild trees
      const mtx = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      scene.children.forEach(o => {
        if (!o.isInstancedMesh || o.count < 200 || o.userData.farm || farmSunk.has(o)) return;
        let n = 0;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, mtx); p.setFromMatrixPosition(mtx);
          if (p.x > C.minX && p.x < C.maxX && p.z > C.minZ && p.z < C.maxZ) { o.setMatrixAt(i, zero); n++; }
        }
        if (n) o.instanceMatrix.needsUpdate = true;
        farmSunk.add(o);
      });
    }
function farmBuildGround() {
      const S = farmSite();
      if (!S || typeof groundGridMesh !== 'function' || !scene) return;
      const C = farmCoverage();
      const xs = farmGroundLines(C.minX, C.maxX, Math.min(S.minX, S.id === 'west' ? S.minX : 100) - FARM_BLEND - 4, Math.max(S.maxX, S.id === 'west' ? -100 : 0) + FARM_BLEND + 4);
      const zs = farmGroundLines(C.minZ, C.maxZ, S.minZ - FARM_BLEND - 4, C.maxZ);
      const mat = (scene.getObjectByName('outerLands') || {}).material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
      const mesh = groundGridMesh(xs, zs, (x, z) => getAnalyticalGroundHeight(x, z), farmGroundColour, mat);
      mesh.name = 'farmGround';
      mesh.userData.farm = true;
      if (farmGroundMesh) { farmGroup.remove(farmGroundMesh); farmGroundMesh.geometry.dispose(); }
      farmGroundMesh = mesh;
      farmGroup.add(mesh);
      farmSinkOldGround();
    }
// The heights change while he grades: refresh the same mesh in place
function farmRefreshGround() {
      if (!farmGroundMesh) return farmBuildGround();
      const g = farmGroundMesh.geometry, pos = g.attributes.position, col = g.attributes.color, c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), y = getAnalyticalGroundHeight(x, z);
        pos.setY(i, y);
        farmGroundColour(c, x, y, z);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
      g.computeVertexNormals(); g.computeBoundingSphere();
      if (typeof farmAfterGroundChange === 'function') farmAfterGroundChange();
    }

// The wild land before he clears it: aspen and pine stands, sage, and stones the glaciers left.
// Deterministic spots; land.cleared sweeps from the south fence north, like the grading.
const farmWildSpots = { trees: [], stones: [] };
function farmWildLayout() {
      const S = farmSite();
      farmWildSpots.trees.length = 0; farmWildSpots.stones.length = 0;
      let seed = S.id === 'west' ? 77 : 41;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let k = 0; k < 900 && farmWildSpots.trees.length < 170; k++) {
        const x = S.minX + rnd() * (S.maxX - S.minX), z = S.minZ + rnd() * (S.maxZ - S.minZ);
        // in loose clumps
        if (Math.sin(x * 0.05) * Math.cos(z * 0.043) < 0.15 && rnd() > 0.15) continue;
        farmWildSpots.trees.push({ x, z, s: 0.8 + rnd() * 0.7, pine: rnd() < 0.45, r: rnd() * 6.28 });
      }
      for (let k = 0; k < 120; k++) farmWildSpots.stones.push({ x: S.minX + rnd() * (S.maxX - S.minX), z: S.minZ + rnd() * (S.maxZ - S.minZ), s: 0.35 + rnd() * 0.9, r: rnd() * 6.28 });
    }
function farmClearedAt(z) {
      const S = farmSite(), c = state.farm.land.cleared;
      return c >= 1 || z > S.maxZ - (S.maxZ - S.minZ) * c;
    }
function farmBuildWild() {
      const S = farmSite();
      if (!S) return;
      farmWildLayout();
      if (farmWildMeshes) farmWildMeshes.forEach(m => { farmGroup.remove(m); m.geometry.dispose(); });
      const bark = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.9 });
      const pine = new THREE.MeshStandardMaterial({ color: 0x2f4d2a, roughness: 0.85, flatShading: true });
      const aspen = new THREE.MeshStandardMaterial({ color: 0x7c9a3c, roughness: 0.8, flatShading: true });
      aspen.userData.seasonal = 'leaf';
      const stone = new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.95, flatShading: true });
      const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 2.2, 5); trunkG.translate(0, 1.1, 0);
      const pineG = new THREE.ConeGeometry(1.3, 4.2, 7); pineG.translate(0, 3.6, 0);
      const aspenG = new THREE.IcosahedronGeometry(1.4, 0); aspenG.scale(1, 1.5, 1); aspenG.translate(0, 3.4, 0);
      const stoneG = new THREE.DodecahedronGeometry(0.6, 0); stoneG.scale(1.2, 0.65, 1);
      const T = farmWildSpots.trees, P = T.filter(t => t.pine), A = T.filter(t => !t.pine);
      const mk = (geo, mat, list, name) => {
        const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
        m.name = name; m.userData.farm = true; m.userData.spots = list;
        m.castShadow = true; m.receiveShadow = true;
        farmGroup.add(m);
        return m;
      };
      farmWildMeshes = [mk(trunkG, bark, T, 'farmTrunks'), mk(pineG, pine, P, 'farmPines'), mk(aspenG, aspen, A, 'farmAspens'), mk(stoneG, stone, farmWildSpots.stones, 'farmStones')];
      farmRefreshWild();
    }
function farmRefreshWild() {
      if (!farmWildMeshes) return;
      const S = farmSite(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
      // Stones he picked go on piles along the north fence
      const pileAt = k => farmWorld(10 + (k % 6) * 34, 216 - Math.floor(k / 6) * 1.2);
      let picked = 0;
      farmWildMeshes.forEach(mesh => {
        const list = mesh.userData.spots;
        list.forEach((t, i) => {
          let x = t.x, z = t.z, sc = t.s;
          if (farmClearedAt(z)) {
            if (mesh.name !== 'farmStones') { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); return; }
            const p = pileAt(picked % 6); picked++;
            x = p.x + Math.sin(i * 2.3) * 2.4; z = p.z + Math.cos(i * 1.7) * 1.4; sc = t.s * 0.8;
          }
          const y = getAnalyticalGroundHeight(x, z) - (mesh.name === 'farmStones' ? 0.1 : 0.15);
          q.setFromAxisAngle(up, t.r);
          m.compose(v.set(x, y, z), q, s.set(sc, sc * (mesh.name === 'farmStones' ? 1 : 0.9 + (i % 5) * 0.06), sc));
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere ? mesh.computeBoundingSphere() : null;
        farmInstancedBounds(mesh);
      });
    }
// Instanced meshes: a bounding sphere/box over every copy, so frustum culling and js/chunks.js see them
function farmInstancedBounds(mesh) {
      const box = new THREE.Box3(), m = new THREE.Matrix4(), v = new THREE.Vector3();
      mesh.geometry.computeBoundingSphere();
      const r = mesh.geometry.boundingSphere.radius * 2;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m); v.setFromMatrixPosition(m);
        if (m.elements[0] === 0 && m.elements[5] === 0) continue;
        box.expandByPoint(v);
      }
      if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3());
      box.expandByScalar(r);
      mesh.geometry.boundingBox = box;
      mesh.geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    }

// The lane's gravel and the farm roads (one mesh), drawn as built
function farmBuildLane() {
      const S = farmSite();
      if (!S) return;
      if (farmLaneMesh) { farmGroup.remove(farmLaneMesh); farmLaneMesh.geometry.dispose(); farmLaneMesh = null; }
      const F = state.farm.land;
      if (F.lane <= 0) return;
      const segs = [];
      const P = farmLanePoints(), L = farmLaneLength(), upto = F.lane * L;
      let run = 0;
      for (let i = 1; i < P.length; i++) {
        const [ax, az] = P[i - 1], [bx, bz] = P[i], len = Math.hypot(bx - ax, bz - az);
        if (run >= upto) break;
        const k = Math.min(1, (upto - run) / len);
        segs.push([ax, az, ax + (bx - ax) * k, az + (bz - az) * k, 4.8]);
        run += len;
      }
      if (F.lane >= 1) {
        const a = farmWorld(0, FARM_GATE_DM), b = farmWorld(FARM_FIELD_ROAD_XM, FARM_GATE_DM), c = farmWorld(FARM_FIELD_ROAD_XM, 214);
        segs.push([a.x, a.z, b.x, b.z, 4.8], [b.x, b.z, c.x, c.z, 4]);
      }
      const pos = [], idx = [];
      segs.forEach(([ax, az, bx, bz, w]) => {
        const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / (len || 1), uz = (bz - az) / (len || 1), nx = -uz * w / 2, nz = ux * w / 2;
        const n = Math.max(1, Math.ceil(len / 3)), base = pos.length / 3;
        for (let k = 0; k <= n; k++) {
          const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
          pos.push(x + nx, getAnalyticalGroundHeight(x + nx, z + nz) + 0.06, z + nz, x - nx, getAnalyticalGroundHeight(x - nx, z - nz) + 0.06, z - nz);
          if (k) { const a0 = base + (k - 1) * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      farmLaneMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xa39a88, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
      farmLaneMesh.name = 'farmLane';
      farmLaneMesh.receiveShadow = true;
      farmGroup.add(farmLaneMesh);
    }

// The fence: treated posts every 5 m and four strands of woven wire, a 16 ft gate at the lane;
// land.fenced 0..1 runs round the site from the gate. Posts are one instanced mesh, wire one mesh.
function farmFenceRun() {
      const S = farmSite();
      const a = farmWorld(0, FARM_GATE_DM + 3), pts = [];
      // corners, clockwise from the gate's north post (west fence, north, east, south, back up to the gate)
      const corners = S.id === 'west'
        ? [[S.maxX, a.z], [S.maxX, S.minZ], [S.minX, S.minZ], [S.minX, S.maxZ], [S.maxX, S.maxZ], [S.maxX, S.maxZ - (FARM_GATE_DM - 3) * FARM_U]]
        : [[S.minX, a.z], [S.minX, S.minZ], [S.maxX, S.minZ], [S.maxX, S.maxZ], [S.minX, S.maxZ], [S.minX, S.maxZ - (FARM_GATE_DM - 3) * FARM_U]];
      for (let i = 1; i < corners.length; i++) pts.push([...corners[i - 1], ...corners[i]]);
      return pts;
    }
function farmBuildFence() {
      if (farmFenceGroup) { farmGroup.remove(farmFenceGroup); farmFenceGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); farmFenceGroup = null; }
      const F = state.farm.land;
      if (F.fenced <= 0) return;
      farmFenceGroup = new THREE.Group();
      farmFenceGroup.name = 'farmFence';
      const runs = farmFenceRun(), total = runs.reduce((s, r) => s + Math.hypot(r[2] - r[0], r[3] - r[1]), 0), upto = F.fenced * total, step = 5 * FARM_U;
      const posts = [], wire = [];
      let run = 0;
      runs.forEach(([ax, az, bx, bz]) => {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / step);
        for (let k = 0; k <= n; k++) {
          const d = run + len * k / n;
          if (d > upto) break;
          const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
          posts.push([x, getAnalyticalGroundHeight(x, z), z]);
          if (k) {
            const px = ax + (bx - ax) * (k - 1) / n, pz = az + (bz - az) * (k - 1) / n;
            wire.push([px, pz, x, z]);
          }
        }
        run += len;
      });
      const postGeo = new THREE.CylinderGeometry(0.09, 0.1, 2.0, 6); postGeo.translate(0, 0.9, 0);
      const pm = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x6d5a43, roughness: 0.9 }), Math.max(1, posts.length));
      const m = new THREE.Matrix4();
      posts.forEach(([x, y, z], i) => { m.makeTranslation(x, y - 0.1, z); pm.setMatrixAt(i, m); });
      pm.count = posts.length;
      pm.castShadow = true;
      farmInstancedBounds(pm);
      farmFenceGroup.add(pm);
      // the woven wire: a thin see-through band between posts (a wire texture would be one more texture
      // to load; lines of strands read the same from a few metres away)
      const pos = [], idx = [];
      wire.forEach(([ax, az, bx, bz]) => {
        const ya = getAnalyticalGroundHeight(ax, az), yb = getAnalyticalGroundHeight(bx, bz);
        [0.35, 0.75, 1.15, 1.5].forEach(h => {
          const b0 = pos.length / 3;
          pos.push(ax, ya + h, az, bx, yb + h, bz, bx, yb + h + 0.035, bz, ax, ya + h + 0.035, az);
          idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        });
      });
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wg.setIndex(idx);
      wg.computeVertexNormals();
      farmFenceGroup.add(new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })));
      // The gate at the lane (a tube gate on two big posts), and a cattle guard look on the culvert
      if (F.fenced >= 1) {
        const g = farmWorld(0, FARM_GATE_DM), gate = new THREE.Group();
        const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.7, roughness: 0.35 });
        const y = getAnalyticalGroundHeight(g.x, g.z);
        const bigPost = new THREE.CylinderGeometry(0.14, 0.16, 2.4, 8);
        [-1, 1].forEach(sd => { const p = new THREE.Mesh(bigPost, new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9 })); p.position.set(0, 1.0, sd * 4.0); gate.add(p); });
        const leaf = new THREE.Group();
        for (let k = 0; k < 5; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 7.6, 6), steel); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0.3 + k * 0.28, 3.8); leaf.add(bar); }
        [0.05, 7.55].forEach(zz => { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), steel); up.position.set(0, 0.86, zz); leaf.add(up); });
        leaf.position.set(0, 0, -4.0);
        // swung open, along the fence
        leaf.rotation.y = state.farm.land.gateOpen === false ? 0 : -Math.PI / 2 + 0.15;
        gate.add(leaf);
        gate.position.set(g.x, y, g.z);
        if (farmSite().id === 'west') gate.rotation.y = Math.PI;
        gate.userData.leaf = leaf;
        farmFenceGroup.add(gate);
      }
      farmGroup.add(farmFenceGroup);
    }

// Survey stakes with orange flagging at the corners and the building sites (once surveyed)
function farmBuildStakes() {
      if (farmStakeMesh) { farmGroup.remove(farmStakeMesh); farmStakeMesh.geometry.dispose(); farmStakeMesh = null; }
      const F = state.farm, S = farmSite();
      if (!S || !F.surveyed) return;
      const spots = [[S.minX, S.minZ], [S.minX, S.maxZ], [S.maxX, S.minZ], [S.maxX, S.maxZ]];
      Object.keys(FARM_BUILDINGS).forEach(k => {
        if (FARM_BUILDINGS[k].inside) return;
        const st = (F.buildings[k] || {}).stage;
        if (st && st !== 'staked') return;
        const r = farmBuildingRect(k);
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => spots.push([r.x + a * r.hw, r.z + b * r.hd]));
      });
      FARM_FIELDS_LAYOUT.forEach(L => { const r = farmFieldRect(L); spots.push([r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]); });
      const geo = new THREE.BoxGeometry(0.06, 1.0, 0.06); geo.translate(0, 0.45, 0);
      const flag = new THREE.BoxGeometry(0.02, 0.12, 0.25); flag.translate(0, 0.9, 0.12);
      const merged = typeof joinGeometries === 'function' ? joinGeometries([geo, flag]) : geo;
      const mesh = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 }), spots.length);
      const m = new THREE.Matrix4();
      spots.forEach(([x, z], i) => { m.makeTranslation(x, getAnalyticalGroundHeight(x, z), z); mesh.setMatrixAt(i, m); });
      farmInstancedBounds(mesh);
      mesh.name = 'farmStakes';
      farmStakeMesh = mesh;
      farmGroup.add(mesh);
    }

// Everything of the land, (re)built
function farmBuildLand3D() {
      if (typeof scene === 'undefined' || !scene || !farmSite()) return;
      if (!farmGroup) { farmGroup = new THREE.Group(); farmGroup.name = 'farm'; scene.add(farmGroup); }
      farmBuildGround();
      farmBuildWild();
      farmBuildLane();
      farmBuildFence();
      farmBuildStakes();
    }
