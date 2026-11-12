// Kelo-bot-1 — js/roads.js
// Loaded right after agent.js (map layout redesign, 2026-11). His roads and paths, as data: polylines
// with a width and a surface. They are drawn in the ground itself (the terrain's colours pick the
// gravel or path texture, js/scene.js), kept clear of trees, plantings and digs (offLimits,
// js/landscape.js), shown on the minimap and the Map tab (js/minimap.js), counted as roads by the
// trip planner (tripOnRoad, js/trips.js), and preferred by paths (findPath, js/scene.js).
//   - Main Street: the town's street between the north row (Museum, house, welding studio and work
//     bench, Storehouse, MAP_LAYOUT) and the backs of the shore row, out to the vehicle yard.
//   - Shore Promenade: the footpath past the cafe, NetNode and Post Office doors, the garden and the dock.
//   - Two lanes between them: Garden Lane (west of the garden) and NetNode Lane (between NetNode and the
//     Post Office); east of the Post Office the vehicle yard is open ground.
//   - Workshop Road: from the vehicle yard south of the helipad to the Workshop's lane and the plant.
//   - Haul road: from the plant's pad up the east road to the pass; the paved Pass Road on through the
//     cut to the north yard. It is the way pathPassRoute (js/scene.js) takes.
//   - North yard: Yard Street (the garage hall's doors, the big hangar's back), Hangar Lane between the
//     two buildings, North Apron (the hangar's door, the hall's back door, the runway field's taxiway).
//     Paved roads also get a real surface (buildRoadSurfaces3D): asphalt, gravel shoulders and lines.

const MAIN_STREET = { z: -7.4, w: 4.4, x0: -34, x1: 14.8 };   // (it turns south into the yard short of the Disposal Pit)
const KELO_ROADS = [
  { id: 'main_street', name: 'Main Street', kind: 'gravel', w: MAIN_STREET.w,
    pts: [[MAIN_STREET.x0, MAIN_STREET.z], [MAIN_STREET.x1, MAIN_STREET.z], [17.8, -3.6]] },
  { id: 'shore_promenade', name: 'Shore Promenade', kind: 'path', w: 2.4, pts: [[-24, 6.5], [19, 6.5]] },
  { id: 'garden_lane', name: 'Garden Lane', kind: 'path', w: 1.6, pts: [[-13.4, -5.2], [-13.4, 5.3]] },
  { id: 'netnode_lane', name: 'NetNode Lane', kind: 'path', w: 2.0, pts: [[4.65, -5.2], [4.65, 5.4]] },
  { id: 'workshop_road', name: 'Workshop Road', kind: 'gravel', w: 4.2, pts: [[30.5, 2.6], [33, 5.2], [56.5, 5.2], [65, 5.2]] },
  // The way over the range (pathPassRoute, js/scene.js). `through`: nothing parks on it (reparkOldVehicles).
  { id: 'haul_road', name: 'Haul road over the pass', kind: 'gravel', w: 4.2, through: true, pts: [[65, 5.2], [65.2, -8], [65.5, -26]] },
  // North yard (owner, 2026-11-12): a paved two-lane road through the pass cut, the street along the
  // garage hall's doors and the big hangar's back, the lane between the two buildings, and the north
  // apron past the hangar's door and the hall's back door to the runway field's taxiway
  { id: 'pass_road', name: 'Pass Road', kind: 'paved', w: 5.2, through: true, pts: [[65.5, -26], [63.5, -44], [62, -62], [62, -106]] },
  { id: 'yard_street', name: 'Yard Street', kind: 'paved', w: 5.6, through: true, pts: [[18, -106], [106, -106]] },
  { id: 'hangar_lane', name: 'Hangar Lane', kind: 'paved', w: 5.2, through: true, pts: [[68, -106], [68, -150]] },
  { id: 'north_apron', name: 'North Apron', kind: 'paved', w: 5.6, through: true, pts: [[50, -150], [84, -150]] }
];

// Distance from (x, z) to a road's centre line
function roadCentreDistance(r, x, z) {
      let best = Infinity;
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i];
        const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (d < best) best = d;
      }
      return best;
    }

// Each road's box, for quick rejects
const KELO_ROAD_BOXES = KELO_ROADS.map(r => {
  const xs = r.pts.map(p => p[0]), zs = r.pts.map(p => p[1]), h = r.w / 2;
  return { r, minX: Math.min(...xs) - h, maxX: Math.max(...xs) + h, minZ: Math.min(...zs) - h, maxZ: Math.max(...zs) + h };
});

// The road at (x, z) (pad widens every road), or null
function keloRoadAt(x, z, pad = 0) {
      for (const b of KELO_ROAD_BOXES) {
        if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
        if (roadCentreDistance(b.r, x, z) < b.r.w / 2 + pad) return b.r;
      }
      return null;
    }

function onKeloRoad(x, z, pad = 0) {
      return Boolean(keloRoadAt(x, z, pad));
    }

// Each road segment's box (for keeping grass tufts off them, js/realism.js)
function keloRoadRects() {
      const out = [];
      KELO_ROADS.forEach(r => {
        for (let i = 1; i < r.pts.length; i++) {
          const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], h = r.w / 2;
          out.push({ minX: Math.min(ax, bx) - h, maxX: Math.max(ax, bx) + h, minZ: Math.min(az, bz) - h, maxZ: Math.max(az, bz) + h });
        }
      });
      return out;
    }

// The ground's colour on a road (the terrain material reads it to choose the gravel or path texture);
// the edges blend into the grass over the last half unit
const ROAD_COLOURS = { gravel: 0x8f8270, path: 0xa3927a, paved: 0x6f6b66 };
function keloRoadColour(c, x, z) {
      const r = keloRoadAt(x, z, 0.5);
      if (!r) return false;
      const edge = Math.min(1, Math.max(0, (r.w / 2 + 0.5 - roadCentreDistance(r, x, z)) / 0.9));
      if (edge <= 0) return false;
      const keep = c.clone();
      c.setHex(ROAD_COLOURS[r.kind] || ROAD_COLOURS.gravel);
      if (edge < 1) c.lerp(keep, 1 - edge);
      return true;
    }

// --- Paved road surfaces ----------------------------------------------------------------------------
// One mesh for every paved road (one draw call): gravel shoulders, the asphalt mat, white edge lines
// and a dashed yellow centre line, laid a few centimetres over the ground (getAnalyticalGroundHeight)
// along the centre line. Lines stop where another paved road crosses, so junctions read as junctions.
const ROAD_SURFACE = { shoulder: 0.8, step: 1.0, lift: { shoulder: 0.035, mat: 0.06, line: 0.08 }, edgeIn: 0.3, edgeW: 0.14, dash: [3, 3], centreW: 0.14 };
let roadSurfaceMesh = null;
function roadSamples(r, step) {
      const out = [];
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / step));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, s: (out.length ? out[out.length - 1].s : 0) + (out.length ? len / n : 0) });
      }
      // the sideways direction at each sample (averaged over its neighbours, so corners don't tear)
      out.forEach((p, i) => {
        const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        p.nx = -(b.z - a.z) / l; p.nz = (b.x - a.x) / l;
      });
      return out;
    }
function buildRoadSurfaces3D() {
      if (roadSurfaceMesh || typeof THREE === 'undefined' || typeof scene === 'undefined') return roadSurfaceMesh;
      const S = ROAD_SURFACE, pos = [], col = [], idx = [], c = new THREE.Color();
      const paved = KELO_ROADS.filter(r => r.kind === 'paved');
      const ground = (x, z) => getAnalyticalGroundHeight(x, z);
      // A strip between two offsets from the centre line (a, b), for samples where keep(p) is true
      const strip = (r, smp, a, b, lift, hex, keep) => {
        c.setHex(hex);
        let prev = -1;
        smp.forEach((p, i) => {
          if (keep && !keep(p, i)) { prev = -1; return; }
          const base = pos.length / 3;
          [a, b].forEach(o => {
            const x = p.x + p.nx * o, z = p.z + p.nz * o;
            pos.push(x, ground(x, z) + lift, z); col.push(c.r, c.g, c.b);
          });
          if (prev >= 0) idx.push(prev, prev + 1, base, prev + 1, base + 1, base);
          prev = base;
        });
      };
      const inOther = (r, x, z, pad = 0) => paved.some(o => o !== r && roadCentreDistance(o, x, z) < o.w / 2 + pad);
      paved.forEach((r, ri) => {
        const smp = roadSamples(r, S.step), h = r.w / 2, mat = S.lift.mat + ri * 0.004;
        strip(r, smp, -h - S.shoulder, h + S.shoulder, S.lift.shoulder, 0x9a8f7c);
        strip(r, smp, -h, h, mat, 0x3b3c3f);
        const clear = p => !inOther(r, p.x, p.z, 0.4);
        [-1, 1].forEach(sd => strip(r, smp, Math.min(sd * (h - S.edgeIn), sd * (h - S.edgeIn - S.edgeW)), Math.max(sd * (h - S.edgeIn), sd * (h - S.edgeIn - S.edgeW)), S.lift.line, 0xe8e6df, (p) => clear({ x: p.x + p.nx * sd * h, z: p.z + p.nz * sd * h }) && clear(p)));
        strip(r, smp, -S.centreW / 2, S.centreW / 2, S.lift.line, 0xe0b532, (p, i) => clear(p) && (p.s % (S.dash[0] + S.dash[1])) < S.dash[0]);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.name = 'roadSurfaces';
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      scene.add(m);
      roadSurfaceMesh = m;
      return m;
    }
