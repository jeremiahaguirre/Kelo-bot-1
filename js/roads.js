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
//   - Haul road: from the plant's pad up the east road, through the pass to the north yard (garage
//     hall, big hangar, the runway field's taxiway). It is the way pathPassRoute (js/scene.js) takes.

const MAIN_STREET = { z: -7.4, w: 4.4, x0: -34, x1: 14.8 };   // (it turns south into the yard short of the Disposal Pit)
const KELO_ROADS = [
  { id: 'main_street', name: 'Main Street', kind: 'gravel', w: MAIN_STREET.w,
    pts: [[MAIN_STREET.x0, MAIN_STREET.z], [MAIN_STREET.x1, MAIN_STREET.z], [17.8, -3.6]] },
  { id: 'shore_promenade', name: 'Shore Promenade', kind: 'path', w: 2.4, pts: [[-24, 6.5], [19, 6.5]] },
  { id: 'garden_lane', name: 'Garden Lane', kind: 'path', w: 1.6, pts: [[-13.4, -5.2], [-13.4, 5.3]] },
  { id: 'netnode_lane', name: 'NetNode Lane', kind: 'path', w: 2.0, pts: [[4.65, -5.2], [4.65, 5.4]] },
  { id: 'workshop_road', name: 'Workshop Road', kind: 'gravel', w: 4.2, pts: [[30.5, 2.6], [33, 5.2], [56.5, 5.2], [65, 5.2]] },
  { id: 'haul_road', name: 'Haul road over the pass', kind: 'gravel', w: 4.2, pts: [[65, 5.2], [65.2, -8], [65.5, -26], [62, -62], [62, -101], [68, -110], [68, -146]] }
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
const ROAD_COLOURS = { gravel: 0x8f8270, path: 0xa3927a };
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
