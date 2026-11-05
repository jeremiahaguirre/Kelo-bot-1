// Kelo-bot-1 — js/shopvisit.js
// Loaded after explore.js and eyecam.js. Visiting the Workshop yourself: click the Workshop (or its
// pin, "Visit the Workshop" in Places or the World tab) and pick the hangar, the north wing or a
// floor, then walk round it at Kelo-1's eye height: WASD / arrow keys and a mouse drag on a desktop,
// the joystick and a finger drag on a phone. The stairs and the car elevator take you between
// floors; the roof and the floors above you are hidden while you are inside so the room is lit.
// Looking at a machine (or clicking / tapping it) shows its status card, read live from the machine
// framework (js/machines.js and the machine files): what it is, what it is doing, what is loaded,
// what it last made. Kelo-1 carries on with his life meanwhile: nothing here changes his state.
// The camera mode is state.cameraMode = 'visit' (js/explore.js hands the frame to shopVisitFrame).

const SV_EYE = 1.55;            // eye height above the floor (Kelo-1's head)
const SV_R = 0.25;              // the visitor's half-width against walls and machines
const SV_WALK = 2.3, SV_RUN = 4.4;
const SV_FOV = 68;
const SV_AREAS = [
  { key: 'hangar', icon: '✈️', name: 'Hangar & Assembly', short: 'Hangar', floor: 1, note: 'build bays, parking, bridge crane' },
  { key: 'wing', icon: '🛠️', name: 'North wing (CNC hall)', short: 'Wing', floor: 1, note: 'Haas mills, racking, forklift charger' },
  { key: 'f1', icon: '1', name: 'Floor 1', short: 'Floor 1', floor: 1, note: '3D printers, CNC routers, Taurus, weld bay' },
  { key: 'f2', icon: '2', name: 'Floor 2 (electronics and garage)', short: 'Floor 2', floor: 2, note: 'PCB line, laser, car lifts' },
  { key: 'f3', icon: '3', name: 'Floor 3 (glass and wood)', short: 'Floor 3', floor: 3, note: 'glass studio, woodshop' }
];
const SV_KIND = { printer: '3D printing', post: 'Post-processing', cnc: 'CNC', electronics: 'Electronics', garage: 'Garage', glass: 'Glass studio', wood: 'Woodshop' };
const SV_STATE_LABEL = { run: 'Running', injob: 'In a job', needs: 'Needs supplies', worn: 'Worn', idle: 'Idle', off: 'Off' };

const shopVisit = {
  on: false, floor: 1, x: 0, z: 0, yaw: 0, pitch: 0.12, zoom: 1,
  saved: null, prevMode: 'follow', enterT: 0, trans: null, stairCool: false,
  geo: null, roofs: null, targets: null, dyn: [], dynN: 0,
  looked: null, pinned: null, lastScan: 0, lastUi: 0, lastList: 0, lastDyn: 0, lastLook: 0,
  shift: false, bob: 0, phase: 0, liftShown: false, listOpen: false, filter: '', chip: 'all', builtUpper: {}, cardKey: '', area: ''
};
const _svV = new THREE.Vector3(), _svT = new THREE.Vector3(), _svDir = new THREE.Vector3(), _svHit = new THREE.Vector3();
const _svRay = new THREE.Ray();
for (let i = 0; i < 24; i++) shopVisit.dyn.push({ x: 0, z: 0, r: 0 });

function shopVisitActive() { return shopVisit.on; }

// --- Where you can walk -------------------------------------------------------------------------
// World rectangles per floor (the union is walkable; the visitor's square must stay inside it),
// circles round the machines, the stair and elevator zones, and where each area starts.
function svGeo() {
      if (shopVisit.geo) return shopVisit.geo;
      if (typeof wsGroup === 'undefined' || !wsGroup || typeof wsWingBounds !== 'function') return null;
      const S = WORKSHOP_SITE, H = WORKSHOP_HANGAR, b = wsWingBounds(), sd = WS_WING.doors.shop, hd = WS_WING.doors.hangar;
      const L = (x0, x1, z0, z1) => ({ x0: S.x + x0, x1: S.x + x1, z0: S.z + z0, z1: S.z + z1 });
      const lx0 = WS_LIFT.x - WS_LIFT.w / 2 - 0.1, lz0 = WS_LIFT.z - WS_LIFT.d / 2 - 0.1, ix = WS_IN.x, iz = WS_IN.z;
      const areas = {
        shop: L(-ix, ix, -iz, iz),
        wing: L(b.x0 + 0.2, b.x1 - 0.2, b.z0 + 0.2, b.z1 - 0.2),
        hangar: { x0: H.x - H.w / 2 + 0.3, x1: H.x + H.w / 2 - 0.3, z0: H.z - H.d / 2 + 0.3, z1: H.z + H.d / 2 - 0.3 }
      };
      const rects = {
        1: [areas.shop, areas.wing, areas.hangar,
          L(sd.x - sd.w / 2 + 0.15, sd.x + sd.w / 2 - 0.15, b.z1 - 0.9, -iz + 0.9),                       // door 4, shop to wing
          { x0: areas.hangar.x1 - 0.9, x1: areas.wing.x0 + 0.9, z0: S.z + hd.z - hd.w / 2 + 0.2, z1: S.z + hd.z + hd.w / 2 - 0.2 }], // door 5, hangar to wing
        2: [L(-3.95, lx0, -iz, iz), L(lx0 - 0.6, ix, -iz, lz0), L(-7.75, -3.6, 6.55, iz), L(-7.75, -6.15, 3.0, iz)],
        3: [L(-ix, -6.0, -iz, 2.35), L(-6.15, lx0, -iz, iz), L(lx0 - 0.6, ix, -iz, lz0), L(-7.75, -6.0, 6.55, iz), L(-6.95, -6.0, 3.0, iz)]
      };
      const P = (lx, lz, yaw) => ({ x: S.x + lx, z: S.z + lz, yaw });
      // Walking into a flight of stairs takes you up or down it
      const zones = [
        { floor: 1, to: 2, r: L(-7.75, -6.95, 3.3, 6.6), arrive: P(-5.3, 6.95, Math.PI / 2) },
        { floor: 2, to: 1, r: L(-6.95, -6.15, 3.3, 6.6), arrive: P(-6.0, 6.9, Math.PI / 2) },
        { floor: 2, to: 3, r: L(-7.75, -6.95, 3.3, 6.6), arrive: P(-5.5, 6.9, Math.PI / 2) },
        { floor: 3, to: 2, r: L(-6.95, -6.15, 3.3, 6.6), arrive: P(-5.3, 6.95, Math.PI / 2) }
      ];
      // Stepping onto the car elevator (its landing gate) offers a ride
      const lift = { 1: L(3.9, 7.7, 4.4, 7.2), 2: L(2.85, 3.75, 4.9, 7.1), 3: L(2.85, 3.75, 4.9, 7.1) };
      const liftSpot = f => P(lx0 - 0.65, WS_LIFT_GATE, Math.PI);
      const toW = c => ({ x: S.x + c.x, z: S.z + c.z, r: c.r });
      const circles = {
        1: (typeof wsObstacles === 'function' ? wsObstacles(1) : []).concat(svStationCircles()).map(toW),
        2: workshopMachinesOn(2).flatMap(d => machineCircles(d)).map(toW),
        3: workshopMachinesOn(3).flatMap(d => machineCircles(d)).map(toW)
      };
      const starts = {
        hangar: { floor: 1, x: H.x + 5.5, z: H.z + 0.5, yaw: -Math.PI / 2 },
        wing: { floor: 1, ...P(-6.0, WS_WING.aisleZ, Math.PI / 2) },
        f1: { floor: 1, ...P(WS_DOORS.person.x, 6.4, Math.PI) },
        f2: { floor: 2, ...P(-3.3, 6.8, Math.PI - 0.45) },
        f3: { floor: 3, ...P(-1.0, 6.6, Math.PI) }
      };
      // Boxes round the buildings, for a click from outside
      const shopBox = new THREE.Box3(new THREE.Vector3(S.x - S.w / 2, WORKSHOP_PAD_Y, S.z + b.z0), new THREE.Vector3(S.x + S.w / 2, WORKSHOP_PAD_Y + WS_EAVE + 1.4, S.z + S.d / 2));
      const hangarBox = new THREE.Box3(new THREE.Vector3(H.x - H.w / 2, WORKSHOP_PAD_Y, H.z - H.d / 2), new THREE.Vector3(H.x + H.w / 2, WORKSHOP_PAD_Y + H.h + 1.2, H.z + H.d / 2));
      shopVisit.geo = { areas, rects, zones, lift, liftSpot, circles, starts, shopBox, hangarBox };
      return shopVisit.geo;
    }

// The weld bay's screens and the work bench on floor 1 (stations are not machines)
function svStationCircles() {
      const out = [];
      ['weld', 'bench'].forEach(k => {
        const st = WORKSHOP_STATIONS[k];
        if (!st || st.floor !== 1 || !st.local) return;
        const r = Math.min(st.size.w, st.size.d) / 2 + 0.1, n = Math.max(1, Math.ceil(st.size.w / (2 * r)));
        for (let i = 0; i < n; i++) out.push({ x: n === 1 ? st.local.x : st.local.x - st.size.w / 2 + r + i * (st.size.w - 2 * r) / (n - 1), z: st.local.z, r });
      });
      return out;
    }

function svIn(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }

function svPtIn(x, z, rects) {
      for (let i = 0; i < rects.length; i++) if (svIn(rects[i], x, z)) return true;
      return false;
    }

// The visitor's square (and its middle) inside the floor's walkable rectangles
function svInRects(x, z, floor) {
      const rs = shopVisit.geo.rects[floor];
      return svPtIn(x, z, rs) && svPtIn(x - SV_R, z - SV_R, rs) && svPtIn(x + SV_R, z - SV_R, rs) && svPtIn(x - SV_R, z + SV_R, rs) && svPtIn(x + SV_R, z + SV_R, rs);
    }

function svFloorY(floor) { return WORKSHOP_PAD_Y + wsFloorY(floor); }

function svFloorOfY(y) {
      const h = y - WORKSHOP_PAD_Y;
      return h < 3 ? 1 : h < 10 ? 2 : 3;
    }

// Moving things to walk round: Kelo-1 himself and the vehicles on this floor (no allocations)
function svFillDynamic(floor) {
      const d = shopVisit.dyn;
      let n = 0;
      const fy = svFloorY(floor);
      if (keloGroup && Math.abs(keloGroup.position.y - fy) < 1.6) { d[n].x = keloGroup.position.x; d[n].z = keloGroup.position.z; d[n].r = 0.45; n++; }
      const vs = state.vehicles || [];
      for (let i = 0; i < vs.length && n < d.length; i++) {
        const v = vs[i], m = typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] : null;
        const x = m ? m.position.x : v.x, z = m ? m.position.z : v.z, y = m ? m.position.y : WORKSHOP_PAD_Y;
        if (!Number.isFinite(x) || Math.abs(y - fy) > 1.6 || Math.abs(x - WORKSHOP_SITE.x) > 40) continue;
        d[n].x = x; d[n].z = z; d[n].r = /fork ?lift/i.test(v.name) ? 0.95 : v.kind === 'bike' ? 0.6 : 1.3;
        n++;
      }
      shopVisit.dynN = n;
    }

function svBlocked(x, z, floor) {
      const cs = shopVisit.geo.circles[floor];
      for (let i = 0; i < cs.length; i++) { const c = cs[i], dx = x - c.x, dz = z - c.z, m = c.r + SV_R * 0.6; if (dx * dx + dz * dz < m * m) return c; }
      for (let i = 0; i < shopVisit.dynN; i++) { const c = shopVisit.dyn[i], dx = x - c.x, dz = z - c.z, m = c.r + SV_R * 0.6; if (dx * dx + dz * dz < m * m) return c; }
      return null;
    }

function svFree(x, z, floor) { return svInRects(x, z, floor) && !svBlocked(x, z, floor); }

// The nearest free spot to (x, z) on a floor, looking outward in rings
function svFindFree(x, z, floor, maxR = 3.5) {
      if (svFree(x, z, floor)) return { x, z };
      for (let r = 0.4; r <= maxR; r += 0.4) {
        for (let k = 0; k < 16; k++) {
          const a = k / 16 * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
          if (svFree(px, pz, floor)) return { x: px, z: pz };
        }
      }
      return null;
    }

// One step: slide along walls (each axis on its own), then out of anything round in the way
function svMove(dx, dz) {
      const v = shopVisit, f = v.floor, ox = v.x, oz = v.z;
      if (svInRects(v.x + dx, v.z, f)) v.x += dx;
      if (svInRects(v.x, v.z + dz, f)) v.z += dz;
      for (let pass = 0; pass < 2; pass++) {
        const c = svBlocked(v.x, v.z, f);
        if (!c) break;
        const ex = v.x - c.x, ez = v.z - c.z, d = Math.hypot(ex, ez) || 0.001, m = c.r + SV_R * 0.6 + 0.001;
        const px = c.x + ex / d * m, pz = c.z + ez / d * m;
        if (svInRects(px, pz, f)) { v.x = px; v.z = pz; } else { v.x = ox; v.z = oz; break; }
      }
    }

// Which area a world point is in: { key, floor, label } or null (outside)
function svAreaAt(x, z, y) {
      const g = svGeo();
      if (!g) return null;
      const floor = svFloorOfY(y);
      let key = null;
      if (floor === 1 && svIn(g.areas.hangar, x, z)) key = 'hangar';
      else if (floor === 1 && svIn(g.areas.wing, x, z)) key = 'wing';
      else if (svIn(g.areas.shop, x, z)) key = 'f' + floor;
      if (!key) return null;
      const a = SV_AREAS.find(ar => ar.key === key);
      let label = a.key === 'hangar' || a.key === 'wing' ? a.name : a.short;
      if (key[0] === 'f') {
        // name the corner by the nearest machine's kind (Floor 2: Garage)
        let best = null, bd = 16;
        workshopMachinesOn(floor).forEach(d => {
          const dd = (WORKSHOP_SITE.x + d.at.x - x) ** 2 + (WORKSHOP_SITE.z + d.at.z - z) ** 2;
          if (dd < bd && SV_KIND[d.kind]) { bd = dd; best = d; }
        });
        if (best) label += ` (${SV_KIND[best.kind]})`;
      }
      return { key, floor, label };
    }

// --- Things you can look at -------------------------------------------------------------------------
// Every machine with a place, the car elevator, the forklift, vehicles and builds in the hangar.
// Each has a box (world) to aim at; machines use their built model's box when there is one.
function svTargets() {
      if (shopVisit.targets) return shopVisit.targets;
      const S = WORKSHOP_SITE, out = [];
      Object.values(WORKSHOP_MACHINES).forEach(def => {
        if (!def.at) return;
        const area = def.floor === 1 ? (def.at.z < -S.d / 2 ? 'wing' : 'f1') : 'f' + def.floor;
        out.push({ key: def.key, type: 'machine', def, floor: def.floor, area, name: def.name, icon: def.emoji || svKindIcon(def.kind), box: new THREE.Box3(), model: undefined });
      });
      out.push({ key: 'elevator', type: 'elevator', floor: 0, area: 'shop', name: 'Car elevator', icon: '🛗', box: new THREE.Box3() });
      out.push({ key: 'forklift', type: 'forklift', floor: 1, area: 'wing', name: 'Forklift', icon: '🏗️', box: new THREE.Box3() });
      shopVisit.targets = out;
      svUpdateBoxes(true);
      return out;
    }

function svKindIcon(kind) {
      return { printer: '🖨️', post: '🧽', cnc: '🛠️', electronics: '🔌', garage: '🚗', glass: '🔥', wood: '🪵' }[kind] || '⚙️';
    }

function svSetBox(box, cx, y0, cz, hx, h, hz) {
      box.min.set(cx - hx, y0, cz - hz);
      box.max.set(cx + hx, y0 + h, cz + hz);
    }

// Boxes for the machines (when their models change) and the things that move. A second or so apart.
function svUpdateBoxes(all = false) {
      const S = WORKSHOP_SITE;
      const list = shopVisit.targets;
      if (!list) return;
      for (const t of list) {
        if (t.type === 'machine') {
          const m = typeof wsModels !== 'undefined' ? wsModels[t.key] : null;
          const live = m && m.parent ? m : null;
          if (!all && live === t.model) continue;
          t.model = live;
          if (live) { live.updateMatrixWorld(true); t.box.setFromObject(live); if (!t.box.isEmpty()) continue; }
          const d = t.def, sz = d.size || { w: 1, h: 1.2, d: 1 }, a = d.at.ry || 0;
          const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
          svSetBox(t.box, S.x + d.at.x, svFloorY(d.floor), S.z + d.at.z, c * sz.w / 2 + s * sz.d / 2, sz.h || 1.2, s * sz.w / 2 + c * sz.d / 2);
        } else if (t.type === 'elevator') {
          const y = svFloorY(1) + (typeof workshopTrip !== 'undefined' ? workshopTrip.liftY || 0 : 0);
          svSetBox(t.box, S.x + WS_LIFT.x, y - 0.15, S.z + WS_LIFT.z, WS_LIFT.w / 2, 1.25, WS_LIFT.d / 2);
        } else if (t.type === 'forklift') {
          const v = typeof theForklift === 'function' ? theForklift() : null;
          const m = v && typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] : null;
          const C = typeof FORKLIFT_CHARGER !== 'undefined' ? FORKLIFT_CHARGER : { x: S.x - 7.5, z: S.z - 8.4 };
          const x = m ? m.position.x : v ? v.x : C.x, z = m ? m.position.z : v ? v.z : C.z, y = m ? m.position.y : svFloorY(1);
          svSetBox(t.box, x, y - 0.1, z, v ? 1.1 : 0.5, v ? 2.3 : 1.6, v ? 1.1 : 0.5);
          t.floor = svFloorOfY(y);
          const a = svAreaAt(x, z, y);
          t.area = a ? a.key : 'outside';
          t.name = v ? plainItemSv(v.name) : 'Forklift charger';
        }
      }
      svUpdateParked();
    }

function plainItemSv(name) {
      const s = String(name || '').replace(/^(an?|the|some|my)\s+/i, '');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

// Vehicles parked inside and builds in the hangar's bays (a few at most), kept by id
function svUpdateParked() {
      const list = shopVisit.targets, keep = new Set();
      const add = (key, make) => {
        keep.add(key);
        let t = list.find(o => o.key === key);
        if (!t) { t = { key, box: new THREE.Box3(), ...make() }; list.push(t); }
        return t;
      };
      (state.vehicles || []).forEach(v => {
        if (/fork ?lift/i.test(v.name)) return;
        const m = typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] : null;
        const x = m ? m.position.x : v.x, z = m ? m.position.z : v.z, y = m ? m.position.y : WORKSHOP_PAD_Y;
        if (!Number.isFinite(x)) return;
        const a = svAreaAt(x, z, y);
        if (!a) return;
        const t = add('veh-' + v.id, () => ({ type: 'vehicle', vehicle: v, icon: '🚙' }));
        t.vehicle = v; t.floor = a.floor; t.area = a.key; t.name = plainItemSv(v.name);
        svSetBox(t.box, x, y - 0.1, z, 1.3, 2.2, 1.3);
      });
      (state.buildProjects || []).forEach(p => {
        if (!p || !p.site || !p.site.inWorkshop || p.status === 'finished') return;
        const t = add('build-' + p.id, () => ({ type: 'build', project: p, icon: '🛩️', floor: 1, area: 'hangar' }));
        t.project = p;
        t.name = (p.bom && p.bom.name) || 'A build';
        const m = typeof assemblyMeshes !== 'undefined' ? assemblyMeshes[p.id] : null;
        if (m && m.parent) { m.updateMatrixWorld(true); t.box.setFromObject(m); }
        if (!m || t.box.isEmpty()) svSetBox(t.box, p.site.x, WORKSHOP_PAD_Y, p.site.z, (p.site.w || 3) / 2, 1.5, (p.site.d || 3) / 2);
        const a = svAreaAt(p.site.x, p.site.z, WORKSHOP_PAD_Y + 0.2);
        if (a) t.area = a.key;
      });
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].type === 'vehicle' || list[i].type === 'build') && !keep.has(list[i].key)) list.splice(i, 1);
    }

// Which target a ray meets first (on the visitor's floor), within maxDist. Small things win over
// the big bench or bay they stand in when both are hit at about the same distance.
function svPick(ray, maxDist = 9) {
      const list = svTargets();
      let best = null, bestD = Infinity, bestVol = Infinity;
      for (const t of list) {
        if (t.floor && t.floor !== shopVisit.floor) continue;
        if (!ray.intersectBox(t.box, _svHit)) continue;
        const d = _svHit.distanceTo(ray.origin);
        if (d > maxDist) continue;
        const s = t.box.max.x - t.box.min.x, u = t.box.max.z - t.box.min.z, vol = s * u * (t.box.max.y - t.box.min.y);
        if (d < bestD - 0.6 || (d < bestD + 0.6 && vol < bestVol)) { best = t; bestD = Math.min(d, bestD); bestVol = vol; }
      }
      return best;
    }

// --- Status, read from the machine framework -----------------------------------------------------------
// A station that belongs to a bigger job (the tire changer to the garage, the reflow oven to the PCB
// line) gets its supplies, jobs and log from that job's definition.
function svJobDef(def) {
      const p = def.learnAs && WORKSHOP_MACHINES[def.learnAs];
      return p && p !== def && (p.plan || p.needs || p.needsFor) ? p : def;
    }

function svAgo(at) {
      if (!Number.isFinite(at)) return '';
      const m = Math.round((Date.now() - at) / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return `${m} min ago`;
      const h = Math.round(m / 60);
      return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
    }

// The supplies a machine takes and what he has of each: [{ label, have, awaited, note, kind }]
function svSupplies(job) {
      if (typeof jobNeeds !== 'function') return [];
      return jobNeeds(job).map(k => {
        const s = WORKSHOP_SUPPLIES[k];
        const have = typeof supplyOwned === 'function' ? supplyOwned(k) : null;
        let note = '';
        if (have === 'filament' && typeof totalFilament === 'function') {
          const spools = typeof printerState === 'function' ? printerState().spools.filter(sp => sp.grams > 0).length : 0;
          note = `${Math.round(totalFilament())} g on ${spools} spool${spools === 1 ? '' : 's'}`;
        } else if (have && typeof supplyNote === 'function') note = supplyNote(have);
        const label = have && have !== 'filament' ? plainItemSv(have) : plainItemSv(s ? s.ask : k);
        return { key: k, label, have: Boolean(have), awaited: !have && typeof supplyAwaited === 'function' && supplyAwaited(k), note, kind: s ? s.kind : '' };
      });
    }

// Everything the card shows for a machine
function svMachineInfo(def) {
      const job = svJobDef(def);
      const known = typeof machineKnown === 'function' && machineKnown(def.key);
      const run = typeof workshopJobRunning !== 'undefined' ? workshopJobRunning : null;
      const trip = typeof workshopTrip !== 'undefined' ? workshopTrip : {};
      const stop = trip.active ? trip.stop : null;
      // he is working at it: the trip's stop names it, or (stops that only name a spot) he stands at it
      // during its job
      let here = Boolean(stop && stop.key === def.key);
      if (!here && trip.active && run && run.key === job.key && def.at && typeof indoorTrip !== 'undefined' && indoorTrip.pos && trip.floor === def.floor) {
        const sd = machineStand(def), kx = indoorTrip.pos.x - WORKSHOP_SITE.x, kz = indoorTrip.pos.z - WORKSHOP_SITE.z;
        here = Math.hypot(kx - sd.x, kz - sd.z) < 1.3 || Math.hypot(kx - def.at.x, kz - def.at.z) < Math.max(def.size ? Math.max(def.size.w, def.size.d) / 2 : 0.6, 0.6) + 0.9;
      }
      const supplies = svSupplies(job);
      const missing = supplies.filter(s => !s.have);
      const worn = supplies.filter(s => s.have && s.kind === 'tooling' && /^([01]) of \d+ left/.test(s.note));
      let st = 'idle', text = 'Idle: ready for a job';
      let progress = null, jobTitle = '';
      if (here || (run && run.key === def.key)) {
        st = 'run';
        jobTitle = (run && run.title) || state.moodTitle || '';
        text = here ? `Running: ${state.moodTitle || 'working'}` : 'Running a job (Kelo-1 is at another station of it)';
        if (stop && stop.n) {
          const a = trip.anim, frac = a && a.t0 >= stop.t0 ? Math.min(1, (performance.now() - a.t0) / a.ms) : 0;
          progress = stop.key === def.key || stop.i > 0 ? Math.min(0.99, (stop.i + frac) / stop.n) : Math.min(0.99, frac / stop.n);
        } else progress = 0.02;
      } else if (run && run.key === job.key && job !== def) {
        st = 'injob'; jobTitle = run.title || ''; text = 'Part of the job running now';
      } else if (!known) {
        st = 'off'; text = "Off: Kelo-1 hasn't learned this machine yet";
      } else if (missing.length) {
        st = 'needs'; text = `Needs supplies: ${missing.map(s => s.label).slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`;
      } else if (worn.length) {
        st = 'worn'; text = `Worn: ${worn.map(s => `${s.label} (${s.note})`).join(', ')}`;
      }
      const log = typeof workshopState === 'function' ? workshopState().log : [];
      const last = log.find(l => l.key === def.key || l.key === job.key) || null;
      const lvl = typeof machineLevel === 'function' ? Math.max(machineLevel(def.key), machineLevel(job.key)) : 0;
      let condition = worn.length ? `Tooling worn: ${worn.map(s => s.label).join(', ')}` : '';
      if (def.kind === 'garage' && typeof garageServiceDue === 'function') {
        const due = garageServiceDue();
        if (due) condition = (condition ? condition + '. ' : '') + `Waiting work: ${due.why}`;
      }
      return { st, text, progress, jobTitle, supplies, last, lvl, known, condition, job };
    }

function svInfoFor(t) {
      if (t.type === 'machine') return svMachineInfo(t.def);
      if (t.type === 'elevator') return svLiftInfo();
      if (t.type === 'forklift') return svForkliftInfo();
      if (t.type === 'vehicle') return svVehicleInfo(t.vehicle);
      if (t.type === 'build') return svBuildInfo(t.project);
      return { st: 'idle', text: '' };
    }

function svLiftInfo() {
      const trip = typeof workshopTrip !== 'undefined' ? workshopTrip : { liftY: 0 };
      const y = trip.liftY || 0, heights = [0, WS_F2 - WS_F1, WS_F3 - WS_F1];
      const i = heights.findIndex(h => Math.abs(h - y) < 0.08);
      const at = i >= 0 ? `At floor ${i + 1}` : `Moving, between floor ${y < heights[1] ? 1 : 2} and ${y < heights[1] ? 2 : 3}`;
      let riders = '';
      if (trip.active && typeof indoorTrip !== 'undefined' && indoorTrip.pos && typeof wsOnLift === 'function') {
        const onIt = wsOnLift({ x: indoorTrip.pos.x - WORKSHOP_SITE.x, z: indoorTrip.pos.z - WORKSHOP_SITE.z });
        if (onIt) riders = trip.vehicle ? `Kelo-1 and the ${plainItemSv(trip.vehicle.name).toLowerCase()} are on it` : 'Kelo-1 is riding it';
      }
      return { st: i >= 0 ? 'idle' : 'run', text: `${at}${riders ? `. ${riders}` : ''}`, facts: [['Platform', '4.0 x 9.3 m, 4,500 kg'], ['Floors', '1, 2 and 3']] };
    }

function svForkliftInfo() {
      const v = typeof theForklift === 'function' ? theForklift() : null;
      if (!v) return { st: 'off', text: "No forklift yet. He asks for one once he's done a few Workshop jobs.", facts: [['Charger', 'In the north wing']] };
      const charge = Math.round(typeof forkliftCharge === 'function' ? forkliftCharge(v) : v.charge || 0);
      const busy = typeof forkliftBusy !== 'undefined' && forkliftBusy;
      const m = typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] : null;
      const x = m ? m.position.x : v.x, z = m ? m.position.z : v.z, y = m ? m.position.y : WORKSHOP_PAD_Y;
      const a = svAreaAt(x, z, y);
      const where = a ? a.label : 'outside the Workshop';
      const st = busy ? 'run' : charge < 15 && !v.plugged ? 'needs' : 'idle';
      const text = busy ? `Running: ${state.moodTitle || 'moving a pallet'}` : v.plugged ? 'Charging on its charger' : charge < 15 ? 'Battery low: needs charging' : 'Parked';
      const pallets = (state.workshop && state.workshop.pallets) || [];
      return { st, text, battery: charge, facts: [['Battery', `${charge}%${v.plugged ? ' (charging)' : ''}`], ['Where', where], ['Last pallet', pallets[0] ? `${pallets[0].what}, ${svAgo(pallets[0].at)}` : 'none yet']] };
    }

function svVehicleInfo(v) {
      const driving = state.riding === v.id || (typeof workshopTrip !== 'undefined' && workshopTrip.vehicle === v);
      const cond = typeof vehicleCondition === 'function' && typeof garageVehicles === 'function' && garageVehicles().includes(v) ? vehicleCondition(v) : null;
      const m = typeof vehicleMeshes !== 'undefined' ? vehicleMeshes[v.id] : null;
      const x = m ? m.position.x : v.x, z = m ? m.position.z : v.z;
      const bay = typeof workshopHangarBays === 'function' ? workshopHangarBays().find(b => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) : null;
      const facts = [['Parked in', bay ? plainItemSv(bay.label.toLowerCase()) : (svAreaAt(x, z, m ? m.position.y : 0) || {}).label || 'the Workshop']];
      if (Number.isFinite(v.fuel)) facts.push(['Fuel', `${Math.round(v.fuel)}%`]);
      if (cond !== null) facts.push(['Condition', `${cond}%`]);
      return { st: driving ? 'run' : cond !== null && cond < 40 ? 'worn' : 'idle', text: driving ? 'Kelo-1 is driving it' : cond !== null && cond < 40 ? 'Due a service in the garage' : 'Parked', facts };
    }

function svBuildInfo(p) {
      const pct = typeof bomPercentBuilt === 'function' && p.bom ? bomPercentBuilt(p.bom) : null;
      const facts = [['Status', p.status || 'building'], ['Bay', plainItemSv(String((p.site && (p.site.label || p.site.key)) || 'hangar').toLowerCase())]];
      if (pct !== null) facts.push(['Built', `${pct}%`]);
      return { st: p.status === 'complete' ? 'idle' : 'run', text: p.status === 'gathering' ? 'Gathering parts' : p.status === 'testing' ? 'Being tested' : p.status === 'complete' ? 'Complete' : 'Being built', progress: pct !== null ? pct / 100 : null, facts };
    }

// --- The status card --------------------------------------------------------------------------------
function svCardHtml(t, pinned) {
      const info = svInfoFor(t);
      const e = s => escapeHtml(String(s == null ? '' : s));
      let title = t.name, model = '';
      if (t.type === 'machine') {
        const d = t.def;
        title = d.short ? plainItemSv(d.short) : d.name;
        model = d.short && d.name.toLowerCase() !== title.toLowerCase() ? d.name : SV_KIND[d.kind] || '';
      } else if (t.type === 'elevator') model = 'Platform lift, floors 1-2-3';
      else if (t.type === 'forklift') model = 'Electric workshop forklift';
      else if (t.type === 'vehicle') model = 'Parked in the Workshop';
      else if (t.type === 'build') model = 'Build in the hangar';
      const pct = info.progress !== null && info.progress !== undefined ? Math.round(info.progress * 100) : null;
      const rows = [];
      if (t.type === 'machine') {
        if (info.supplies.length) {
          rows.push(`<div class="sv-sect">Supplies and materials</div><ul class="sv-supplies">${info.supplies.map(s => `<li class="${s.have ? 'sv-have' : s.awaited ? 'sv-wait' : 'sv-miss'}"><span class="sv-dot" aria-hidden="true"></span><span class="sv-sup-name">${e(s.label)}</span><span class="sv-sup-note">${e(s.have ? s.note || 'loaded' : s.awaited ? 'on its way' : 'missing')}</span></li>`).join('')}</ul>`);
        } else rows.push('<div class="sv-sect">Supplies and materials</div><div class="sv-muted">Takes nothing of its own</div>');
        const facts = [['Last job', info.last ? `${info.last.what}, ${info.last.ok ? 'finished' : 'failed'} ${svAgo(info.last.at)}` : 'none yet'], ['His skill', info.known ? `Level ${info.lvl}` : 'not learned']];
        if (info.condition) facts.push(['Condition', info.condition]);
        info.facts = facts;
      }
      if (info.facts) rows.push(`<dl class="sv-facts">${info.facts.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>`);
      return `
        <div class="sv-head">
          <div class="min-w-0"><div class="sv-title">${e(t.icon)} ${e(title)}</div>${model ? `<div class="sv-model">${e(model)}</div>` : ''}</div>
          ${pinned ? '<button type="button" data-sv="card-close" class="explore-x" aria-label="Close the status card">✕</button>' : '<span class="sv-hint">tap for more</span>'}
        </div>
        <div class="sv-state sv-st-${info.st}"><span class="sv-pill">${e(SV_STATE_LABEL[info.st] || '')}</span><span>${e(info.text)}</span></div>
        ${info.jobTitle ? `<div class="sv-job">Job: ${e(info.jobTitle)}</div>` : ''}
        ${pct !== null ? `<div class="sv-bar-out" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="sv-bar-in" style="width:${pct}%"></div></div><div class="sv-pct">${pct}%</div>` : ''}
        ${info.battery !== undefined ? `<div class="sv-bar-out" role="progressbar" aria-label="Battery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${info.battery}"><div class="sv-bar-in sv-bar-batt" style="width:${info.battery}%"></div></div>` : ''}
        ${rows.join('')}`;
    }

function svPhone() { return window.matchMedia('(max-width: 639px)').matches; }

// Pin (or unpin) the full card. On a phone the card and the machines list share the screen, so the
// list steps aside while a card is open and comes back when it closes.
function svPin(t) {
      const was = shopVisit.pinned;
      shopVisit.pinned = t || null;
      if (svPhone()) {
        if (t && !was && shopVisit.listOpen) { shopVisit.listBehind = true; svToggleList(false); }
        else if (!t && was && shopVisit.listBehind) { shopVisit.listBehind = false; svToggleList(true); }
      }
      if (!t) shopVisit.listBehind = false;
      svRenderCard();
    }

function svRenderCard() {
      const el = document.getElementById('svCard');
      if (!el) return;
      const t = shopVisit.pinned || shopVisit.looked;
      if (!t || !shopVisit.on) { el.classList.add('hidden'); shopVisit.cardKey = ''; return; }
      const html = svCardHtml(t, Boolean(shopVisit.pinned));
      if (typeof perfSetHtml === 'function') perfSetHtml(el, html); else el.innerHTML = html;
      el.classList.remove('hidden');
      el.classList.toggle('sv-card-pinned', Boolean(shopVisit.pinned));
      shopVisit.cardKey = t.key;
    }

// --- The machines list (the visitor's area) -----------------------------------------------------------
function svAreaKeyHere() {
      const a = svAreaAt(shopVisit.x, shopVisit.z, svFloorY(shopVisit.floor) + 0.2);
      return a ? a.key : 'f' + shopVisit.floor;
    }

function svListItems() {
      const area = svAreaKeyHere();
      return svTargets().filter(t => {
        if (t.type === 'elevator') return area[0] === 'f';
        if (t.type === 'forklift') return t.area === area || area === 'wing' || area === 'hangar';
        if (t.type === 'machine') return t.area === area && t.def.key !== 'printbench';
        return t.area === area;
      });
    }

function svRenderList(force = false) {
      const box = document.getElementById('svListItems');
      if (!box || !shopVisit.listOpen) return;
      const q = shopVisit.filter.trim().toLowerCase();
      const items = svListItems().map(t => ({ t, info: svInfoFor(t) }))
        .filter(({ t, info }) => (!q || `${t.name} ${t.def ? t.def.short || '' : ''}`.toLowerCase().includes(q)) && (shopVisit.chip === 'all' || info.st === shopVisit.chip || (shopVisit.chip === 'run' && info.st === 'injob')));
      const html = items.length ? items.map(({ t, info }) => `
        <button type="button" role="listitem" data-sv-go="${escapeHtml(t.key)}" class="sv-item${shopVisit.pinned === t ? ' sv-item-on' : ''}">
          <span class="sv-item-icon" aria-hidden="true">${escapeHtml(t.icon)}</span>
          <span class="sv-item-name">${escapeHtml(t.type === 'machine' && t.def.short ? plainItemSv(t.def.short) : t.name)}</span>
          <span class="sv-pill sv-st-${info.st}">${escapeHtml(SV_STATE_LABEL[info.st] || '')}</span>
        </button>`).join('') : '<div class="sv-muted p-2">Nothing here matches.</div>';
      if (typeof perfSetHtml === 'function') perfSetHtml(box, html); else box.innerHTML = html;
      const title = document.getElementById('svListTitle');
      const a = SV_AREAS.find(ar => ar.key === svAreaKeyHere());
      if (title && a) title.textContent = `Here: ${a.short}`;
    }

function svToggleList(open) {
      const el = document.getElementById('svList');
      if (!el) return;
      shopVisit.listOpen = open === undefined ? !shopVisit.listOpen : open;
      el.classList.toggle('hidden', !shopVisit.listOpen);
      document.querySelector('[data-sv="list"]')?.setAttribute('aria-expanded', String(shopVisit.listOpen));
      if (shopVisit.listOpen) {
        if (svPhone() && shopVisit.pinned) { shopVisit.pinned = null; shopVisit.listBehind = false; svRenderCard(); }
        svRenderList(true);
      }
    }

// Walk (glide) over to a thing from the list, face it and show its card
function svGoToTarget(t) {
      if (!t) return;
      const S = WORKSHOP_SITE;
      const floor = t.type === 'elevator' ? shopVisit.floor : t.floor || 1;
      const c = t.box.getCenter(_svT);
      let spot = null;
      if (t.type === 'machine') {
        // a step back from where he stands to work it, so you see the whole machine
        const st = machineStand(t.def), ax = S.x + t.def.at.x, az = S.z + t.def.at.z;
        const ex = S.x + st.x - ax, ez = S.z + st.z - az, el = Math.hypot(ex, ez) || 1;
        const back = camera && camera.aspect < 0.8 ? 1.7 : 0.9;   // (a tall phone screen sees less across)
        spot = svFindFree(S.x + st.x + ex / el * back, S.z + st.z + ez / el * back, floor, 0.4);
        // else a free spot round it at that distance, the front first, then the operator's own spot
        const a0 = Math.atan2(ex, ez), sz = t.def.size || { w: 1, d: 1 }, rr = Math.max(sz.w, sz.d) / 2 + back + 0.5;
        for (let k = 1; k < 16 && !spot; k++) {
          const ang = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
          const px = ax + Math.sin(ang) * rr, pz = az + Math.cos(ang) * rr;
          if (svFree(px, pz, floor)) spot = { x: px, z: pz };
        }
        if (!spot) spot = svFindFree(S.x + st.x, S.z + st.z, floor, 2.5);
      }
      if (!spot) {
        const r = Math.max(t.box.max.x - t.box.min.x, t.box.max.z - t.box.min.z) / 2 + 0.7;
        const dx = shopVisit.x - c.x, dz = shopVisit.z - c.z, a0 = Math.atan2(dx, dz);
        for (let k = 0; k < 16 && !spot; k++) {
          const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
          const px = c.x + Math.sin(a) * r, pz = c.z + Math.cos(a) * r;
          if (svFree(px, pz, floor)) spot = { x: px, z: pz };
        }
      }
      if (!spot) spot = svFindFree(c.x, c.z, floor, 5);
      if (!spot) return;
      svPin(t);
      svTravel({ floor, x: spot.x, z: spot.z, yaw: Math.atan2(c.x - spot.x, c.z - spot.z), pitch: 0.28 });
    }

// --- Moving between places --------------------------------------------------------------------------
// A smooth glide to a spot (any floor). Input waits until it's done.
function svTravel(to, ms) {
      const v = shopVisit, g = svGeo();
      if (!g) return;
      const p = svFindFree(to.x, to.z, to.floor, 3) || to;
      const fromY = svFloorY(v.floor), toY = svFloorY(to.floor);
      const dist = Math.hypot(p.x - v.x, p.z - v.z) + Math.abs(toY - fromY);
      let dy = (to.yaw ?? v.yaw) - v.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      v.trans = { t0: performance.now(), ms: ms || Math.min(2600, 650 + dist * 90), x0: v.x, z0: v.z, y0: fromY, yaw0: v.yaw, p0: v.pitch, x1: p.x, z1: p.z, y1: toY, yaw1: v.yaw + dy, p1: to.pitch ?? 0.12 };
      if (to.floor !== v.floor) svSetFloor(to.floor);
    }

function svSetFloor(f) {
      shopVisit.floor = f;
      svEnsureFloorBuilt(f);
      svApplyCutaway();
      svUpdateFloorButtons();
    }

function svGoArea(key) {
      const g = svGeo();
      if (!g || !g.starts[key]) return;
      if (!shopVisit.on) return shopVisitStart(key);
      svTravel(g.starts[key]);
    }

// "Go to floor N": to the car elevator's landing on that floor
function svGoFloor(f) {
      const g = svGeo();
      if (!g || !shopVisit.on) return;
      svTravel({ floor: f, ...g.liftSpot(f) }, f === shopVisit.floor ? undefined : 2200);
    }

// Find Kelo-1: next to him if he is in the Workshop, otherwise back outside to follow him
function svFindKelo() {
      if (!keloGroup) return;
      const p = keloGroup.position, a = svAreaAt(p.x, p.z, p.y + 0.3);
      if (!a) {
        shopVisitExit(false);
        if (typeof exploreFlyToKelo === 'function') exploreFlyToKelo();
        return;
      }
      svFillDynamic(a.floor);
      shopVisit.dynN = 0;   // (he is not in his own way)
      let spot = null;
      const a0 = Math.atan2(shopVisit.x - p.x, shopVisit.z - p.z);
      for (const r of [2.0, 2.6, 1.5, 3.2]) {
        for (let k = 0; k < 16 && !spot; k++) {
          const ang = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
          const x = p.x + Math.sin(ang) * r, z = p.z + Math.cos(ang) * r;
          if (svFree(x, z, a.floor)) spot = { x, z };
        }
        if (spot) break;
      }
      if (!spot) spot = svFindFree(p.x, p.z, a.floor, 5);
      if (spot) svTravel({ floor: a.floor, x: spot.x, z: spot.z, yaw: Math.atan2(p.x - spot.x, p.z - spot.z), pitch: 0.18 });
    }

// --- Hiding the roof and the floors above ----------------------------------------------------------
function svUnder(o, root) {
      for (let p = o; p; p = p.parent) if (p === root) return true;
      return false;
    }

function svRoofs() {
      if (shopVisit.roofs) return shopVisit.roofs;
      const decks = new Set([...(wsDeckMeshes || []), ...(wsDeck3Meshes || [])]);
      const hangar = typeof wsHangar !== 'undefined' ? wsHangar : null;
      shopVisit.roofs = (typeof cutawayRoofMeshes !== 'undefined' ? cutawayRoofMeshes : []).filter(m => !decks.has(m) && (svUnder(m, wsGroup) || (hangar && svUnder(m, hangar))));
      return shopVisit.roofs;
    }

// Every frame while visiting (a few meshes): his trips set the decks too, so this keeps the view right
function svApplyCutaway() {
      const f = shopVisit.floor;
      const roofs = svRoofs();
      for (let i = 0; i < roofs.length; i++) roofs[i].visible = false;
      for (let i = 0; i < wsDeckMeshes.length; i++) { const m = wsDeckMeshes[i]; m.visible = f >= 2; if (f >= 2 && m.material.opacity !== 0.98) m.material.opacity = 0.98; }
      for (let i = 0; i < wsDeck3Meshes.length; i++) { const m = wsDeck3Meshes[i]; m.visible = f >= 3; if (f >= 3 && m.material.opacity !== 0.98) m.material.opacity = 0.98; }
      if (wsFloor2) wsFloor2.visible = f >= 2;
      if (wsFloor3) wsFloor3.visible = f >= 3;
    }

function svRestoreCutaway() {
      svRoofs().forEach(m => { m.visible = true; });
      if (wsFloor2) wsFloor2.visible = true;
      if (wsFloor3) wsFloor3.visible = true;
      if (typeof workshopTrip !== 'undefined' && workshopTrip.active) wsSetDecksFor(workshopTrip.floor);
      else if (typeof wsSetDeck === 'function') wsSetDeck(null);
    }

// Floors 2 and 3 are only built while someone is up there (js/workshopbuilding.js). His trip may take
// them down when he leaves, so this builds them again while the visitor is on that floor.
function svEnsureFloorBuilt(f) {
      if (f < 2 || typeof wsUpperBuilt === 'undefined') return;
      if (!wsUpperBuilt[f]) { workshopShowFloor(f, true); shopVisit.builtUpper[f] = true; shopVisit.targets && svUpdateBoxes(true); }
    }

// --- Entering and leaving ---------------------------------------------------------------------------
function shopVisitStart(areaKey = 'f1') {
      if (typeof wsGroup === 'undefined') return;
      if (!wsGroup && typeof buildWorkshop3D === 'function') buildWorkshop3D();
      const g = svGeo();
      if (!g || !camera || !controls) return;
      svCloseChooser();
      const s = g.starts[areaKey] || g.starts.f1;
      if (shopVisit.on) { svTravel(s); return; }
      if (typeof exploreHideSpotMenu === 'function') exploreHideSpotMenu();
      if (typeof exploreTogglePlaces === 'function') exploreTogglePlaces(false);
      if (typeof exploreCam !== 'undefined') exploreCam.fly = null;
      // Through his eyes first hands its camera back (it would undo these settings a frame later)
      if (typeof eyeCam !== 'undefined' && eyeCam.on && typeof eyeCamLeave === 'function') eyeCamLeave();
      const v = shopVisit;
      v.prevMode = ['follow', 'explore', 'eyes'].includes(state.cameraMode) ? state.cameraMode : 'follow';
      v.saved = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, near: camera.near, maxPolar: controls.maxPolarAngle, minDist: controls.minDistance };
      controls.maxPolarAngle = Math.PI;
      controls.minDistance = 0.1;
      camera.near = 0.05;
      v.on = true;
      v.trans = null;
      v.zoom = 1;
      v.pinned = v.looked = null;
      v.builtUpper = {};
      v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.pitch = 0.12;
      v.enterT = performance.now();
      v.stairCool = true;
      state.cameraMode = 'visit';
      svSetFloor(s.floor);
      const free = svFindFree(v.x, v.z, v.floor, 3);
      if (free) { v.x = free.x; v.z = free.z; }
      // Full detail for the whole building while you're in it (js/perf.js keeps it on: shopVisitActive)
      if (typeof wsShowFloor1 === 'function' && typeof wsFloor1Wanted !== 'undefined' && !wsFloor1Wanted) wsShowFloor1(true);
      svTargets();
      svUpdateBoxes(true);
      document.body.classList.add('shopvisit-on');
      document.getElementById('svHud')?.classList.remove('hidden');
      document.getElementById('svCross')?.classList.remove('hidden');
      svUpdateFloorButtons();
      svUpdateHud(true);
      if (typeof exploreFitToPanel === 'function') setTimeout(exploreFitToPanel, 30);
      if (typeof exploreUpdateUI === 'function') exploreUpdateUI();
      if (typeof wsUpdateLighting === 'function') wsUpdateLighting();
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    }

// restore: true puts the camera back where it was (Exit / Esc); false when another mode took over
function svLeave(restore) {
      const v = shopVisit;
      if (!v.on) return;
      v.on = false;
      v.trans = null;
      svRestoreCutaway();
      // take down the upper floors this visit built, unless he is in there on a trip (his trip does it)
      if (!(typeof workshopTrip !== 'undefined' && workshopTrip.active)) [2, 3].forEach(f => { if (v.builtUpper[f] && wsUpperBuilt[f]) workshopShowFloor(f, false); });
      v.builtUpper = {};
      const s = v.saved;
      if (s) {
        camera.fov = s.fov; camera.near = s.near; camera.updateProjectionMatrix();
        controls.maxPolarAngle = s.maxPolar; controls.minDistance = s.minDist;
        if (restore) { camera.position.copy(s.pos); controls.target.copy(s.target); }
      }
      if (typeof exploreCam !== 'undefined') exploreCam.driving = false;
      document.body.classList.remove('shopvisit-on', 'sv-stats-on');
      document.querySelector('#svHud [data-sv="stats"]')?.setAttribute('aria-pressed', 'false');
      if (typeof exploreFitToPanel === 'function') setTimeout(exploreFitToPanel, 30);
      ['svHud', 'svCard', 'svList', 'svCross'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
      v.listOpen = false;
      v.listBehind = false;
      v.pinned = v.looked = null;
      if (typeof wsSetHover === 'function') wsSetHover(null);
    }

function shopVisitExit(restore = true) {
      if (!shopVisit.on) return;
      const prev = shopVisit.prevMode || 'follow';
      svLeave(restore);
      state.cameraMode = prev === 'eyes' ? 'eyes' : prev;
      if (prev === 'explore' && typeof exploreSyncFromCamera === 'function') exploreSyncFromCamera();
      if (typeof exploreUpdateUI === 'function') exploreUpdateUI();
    }

// --- The frame ------------------------------------------------------------------------------------
function shopVisitFrame(dt) {
      const v = shopVisit;
      if (state.cameraMode !== 'visit') { if (v.on) svLeave(false); return false; }
      if (!v.on) { state.cameraMode = 'follow'; return false; }
      if (!camera || !controls || !v.geo) return false;
      const now = performance.now();
      svFillDynamic(v.floor);

      let moving = 0;
      if (v.trans) {
        const T = v.trans, u = Math.min(1, (now - T.t0) / T.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        v.x = T.x0 + (T.x1 - T.x0) * e;
        v.z = T.z0 + (T.z1 - T.z0) * e;
        v.yaw = T.yaw0 + (T.yaw1 - T.yaw0) * e;
        v.pitch = T.p0 + (T.p1 - T.p0) * e;
        v.eyeBase = T.y0 + (T.y1 - T.y0) * e;
        if (u >= 1) { v.trans = null; v.stairCool = true; }
      } else {
        v.eyeBase = svFloorY(v.floor);
        const k = typeof exploreCam !== 'undefined' ? exploreCam.keys : {}, h = typeof exploreCam !== 'undefined' ? exploreCam.held : {}, s = typeof exploreCam !== 'undefined' ? exploreCam.stick : { x: 0, y: 0 };
        let fwd = (k.KeyW || k.ArrowUp || h.up ? 1 : 0) - (k.KeyS || k.ArrowDown || h.down ? 1 : 0) - s.y;
        let side = (k.KeyD || h.right ? 1 : 0) - (k.KeyA || h.left ? 1 : 0) + s.x;
        const turn = (k.ArrowLeft || k.KeyQ || h.turnLeft ? 1 : 0) - (k.ArrowRight || k.KeyE || h.turnRight ? 1 : 0);
        const tilt = (k.KeyF || h.tiltDown ? 1 : 0) - (k.KeyR || h.tiltUp ? 1 : 0);
        const zoom = (k.Equal || k.NumpadAdd || h.zoomIn ? 1 : 0) - (k.Minus || k.NumpadSubtract || h.zoomOut ? 1 : 0);
        if (turn) v.yaw += turn * 1.9 * dt;
        if (tilt) v.pitch = Math.max(-1.25, Math.min(1.3, v.pitch + tilt * 1.1 * dt));
        if (zoom) shopVisitZoom(Math.exp(-zoom * 0.8 * dt));
        const len = Math.hypot(fwd, side);
        if (len > 1) { fwd /= len; side /= len; }
        if (len > 0.01) {
          const sp = (v.shift ? SV_RUN : SV_WALK) * dt, sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
          const ox = v.x, oz = v.z;
          svMove((sy * fwd - cy * side) * sp, (cy * fwd + sy * side) * sp);
          moving = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 1e-3);
        }
        svCheckZones();
      }
      // a slight step bob while walking
      v.phase += moving * dt * 2.4;
      v.bob += ((moving > 0.2 ? Math.sin(v.phase) * 0.022 : 0) - v.bob) * Math.min(1, dt * 10);

      const yaw = v.yaw, pitch = v.pitch;
      const pos = _svV.set(v.x, v.eyeBase + SV_EYE + v.bob, v.z);
      _svDir.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const target = _svT.copy(pos).addScaledVector(_svDir, 2.5);
      const fov = Math.max(35, Math.min(95, (camera.aspect < 0.8 ? 84 : SV_FOV) * v.zoom));
      // glide in from the previous view for the first moment
      const u = Math.min(1, (now - v.enterT) / 800);
      if (u < 1 && v.saved) {
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        camera.position.lerpVectors(v.saved.pos, pos, e);
        controls.target.lerpVectors(v.saved.target, target, e);
        camera.fov = v.saved.fov + (fov - v.saved.fov) * e;
        camera.updateProjectionMatrix();
      } else {
        camera.position.copy(pos);
        controls.target.copy(target);
        if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }

      svApplyCutaway();
      if (typeof wsBuildQueued === 'function' && typeof wsQueue !== 'undefined' && wsQueue.length) wsBuildQueued(3);
      // what you're looking at, a few times a second
      if (now - v.lastScan > 120) {
        v.lastScan = now;
        _svRay.origin.copy(pos);
        _svRay.direction.copy(_svDir);
        const t = svPick(_svRay, 8);
        if (t !== v.looked) { v.looked = t; if (!v.pinned) svRenderCard(); }
        document.getElementById('svCross')?.classList.toggle('sv-cross-on', Boolean(t));
      }
      if (now - v.lastDyn > 1200) { v.lastDyn = now; svEnsureFloorBuilt(v.floor); svUpdateBoxes(false); }
      if (now - v.lastUi > 500) { v.lastUi = now; svUpdateHud(false); if (v.pinned || v.looked) svRenderCard(); }
      if (v.listOpen && now - v.lastList > 1000) { v.lastList = now; svRenderList(); }
      return true;
    }

// Stairs (walk into a flight and you go up or down it) and the car elevator's landing
function svCheckZones() {
      const v = shopVisit, g = v.geo;
      let inStairs = null;
      for (const z of g.zones) if (z.floor === v.floor && svIn(z.r, v.x, v.z)) { inStairs = z; break; }
      if (!inStairs) v.stairCool = false;
      else if (!v.stairCool) {
        v.stairCool = true;
        svTravel({ floor: inStairs.to, x: inStairs.arrive.x, z: inStairs.arrive.z, yaw: inStairs.arrive.yaw, pitch: inStairs.to > v.floor ? -0.05 : 0.25 }, 1500);
      }
      const onLift = svIn(g.lift[v.floor], v.x, v.z);
      if (onLift !== v.liftShown) {
        v.liftShown = onLift;
        document.getElementById('svLift')?.classList.toggle('hidden', !onLift);
      }
    }

// Look round (pixels dragged) and zoom (factor > 1 zooms out)
function shopVisitLook(dx, dy) {
      const v = shopVisit;
      if (!v.on || v.trans) return;
      const k = v.zoom;
      v.yaw -= dx * 0.005 * k;
      v.pitch = Math.max(-1.25, Math.min(1.3, v.pitch + dy * 0.004 * k));
    }

function shopVisitZoom(factor) {
      shopVisit.zoom = Math.max(0.55, Math.min(1.25, shopVisit.zoom * factor));
    }

// Keys while visiting (js/explore.js asks first; true = handled). WASD and arrows go on to it.
function shopVisitKey(e) {
      if (!shopVisit.on) return false;
      if (e.code === 'Escape') {
        if (shopVisit.pinned) { svPin(null); return true; }
        if (shopVisit.listOpen) { svToggleList(false); return true; }
        shopVisitExit(true);
        return true;
      }
      if (e.code === 'KeyK' || e.code === 'Home') { svFindKelo(); return true; }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { svGoFloor(+e.code.slice(-1)); return true; }
      if (e.code === 'KeyM') { svToggleList(); return true; }
      if ((e.code === 'Enter' || e.code === 'KeyI') && shopVisit.looked && e.target === document.body) { svPin(shopVisit.looked); return true; }
      return false;
    }

// Clicks on the 3D view (js/scene.js asks first). Inside: pick a machine (and swallow every other
// click, so nobody is sent anywhere). Outside: a click on the Workshop or the hangar offers a visit.
function shopVisitClick(raycaster, e) {
      if (shopVisit.on) {
        svPin(svPick(raycaster.ray, 25));
        return true;
      }
      const g = svGeo();
      if (!g || !raycaster) return false;
      let d = Infinity;
      if (raycaster.ray.intersectBox(g.shopBox, _svHit)) d = _svHit.distanceTo(raycaster.ray.origin);
      if (raycaster.ray.intersectBox(g.hangarBox, _svHit)) d = Math.min(d, _svHit.distanceTo(raycaster.ray.origin));
      if (!Number.isFinite(d)) return false;
      if (keloGroup) {
        const hk = raycaster.intersectObjects(keloGroup.children, true);
        if (hk.length && hk[0].distance < d + 0.5) return false;
      }
      shopVisitOpenChooser(e ? e.clientX : undefined, e ? e.clientY : undefined);
      return true;
    }

// --- The chooser and the HUD -------------------------------------------------------------------------
function shopVisitOpenChooser(x, y) {
      const el = document.getElementById('svChooser');
      if (!el) return;
      if (typeof exploreHideSpotMenu === 'function') exploreHideSpotMenu();
      el.classList.remove('hidden');
      const vw = window.innerWidth, vh = window.innerHeight, r = el.getBoundingClientRect();
      if (Number.isFinite(x) && Number.isFinite(y) && vw > 640) {
        el.style.left = `${Math.max(8, Math.min(vw - r.width - 8, x + 12))}px`;
        el.style.top = `${Math.max(8, Math.min(vh - r.height - 8, y - 20))}px`;
      } else {
        el.style.left = `${Math.max(8, (vw - r.width) / 2)}px`;
        el.style.top = `${Math.max(8, (vh - r.height) / 2)}px`;
      }
      shopVisit.chooserReturn = document.activeElement;
      el.querySelector('[data-sv-area]')?.focus({ preventScroll: true });
    }

function svCloseChooser() {
      const el = document.getElementById('svChooser');
      if (!el || el.classList.contains('hidden')) return;
      el.classList.add('hidden');
      const back = shopVisit.chooserReturn;
      shopVisit.chooserReturn = null;
      if (back && back.focus && !shopVisit.on && document.body.contains(back)) back.focus({ preventScroll: true });
    }

function svUpdateFloorButtons() {
      const here = shopVisit.on ? svAreaKeyHere() : '';
      document.querySelectorAll('#svHud [data-sv-area]').forEach(b => {
        const on = b.getAttribute('data-sv-area') === here;
        b.classList.toggle('sv-on', on);
        b.setAttribute('aria-current', on ? 'true' : 'false');
      });
      const a = SV_AREAS.find(ar => ar.key === here);
      const name = document.getElementById('svAreaName');
      if (name && a) name.textContent = a.name;
    }

// Where he is and what he's doing, and the area name
function svUpdateHud() {
      const area = svAreaKeyHere();
      if (area !== shopVisit.area) { shopVisit.area = area; svUpdateFloorButtons(); if (shopVisit.listOpen) svRenderList(true); }
      const el = document.getElementById('svKeloText');
      if (!el || !keloGroup) return;
      const p = keloGroup.position, a = svAreaAt(p.x, p.z, p.y + 0.3);
      const doing = state.isSleeping ? 'Sleeping' : plainItemSv(state.moodTitle || 'Busy');
      const sc = typeof stripCoords === 'function' ? stripCoords : x => x;   // (no raw map coordinates)
      const txt = sc(a ? `Kelo-1 is in ${a.label}: ${doing}` : `Kelo-1 is at ${typeof currentPlaceLabel === 'function' ? currentPlaceLabel() : 'the valley'}: ${doing}`);
      if (el.textContent !== txt) el.textContent = txt;
      const btn = document.querySelector('#svHud [data-sv="find"]');
      if (btn) {
        const label = a ? 'Find Kelo-1' : 'Leave and follow him';
        if (btn.textContent !== label) btn.textContent = label;
      }
    }

function svBuildDom() {
      const host = document.getElementById('dioramaViewport');
      if (!host || document.getElementById('svHud')) return;
      const e = s => escapeHtml(s);
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div id="svChooser" class="hidden sv-panel" role="dialog" aria-labelledby="svChooserTitle">
          <div class="sv-head">
            <div class="sv-title" id="svChooserTitle">🏭 Visit the Workshop</div>
            <button type="button" data-sv="chooser-close" class="explore-x" aria-label="Close">✕</button>
          </div>
          <p class="sv-sub">Walk round it yourself and check every machine. Kelo-1 carries on with his day.</p>
          <div class="sv-choices">
            ${SV_AREAS.map(a => `<button type="button" data-sv-area="${e(a.key)}" class="sv-choice"><span class="sv-choice-icon" aria-hidden="true">${e(a.icon)}</span><span class="min-w-0"><span class="sv-choice-name">${e(a.name)}</span><span class="sv-choice-note">${e(a.note)}</span></span></button>`).join('')}
          </div>
        </div>
        <div id="svHud" class="hidden" role="region" aria-label="Workshop visit">
          <div class="sv-bar">
            <div class="sv-where" id="svAreaName" aria-live="polite">Floor 1</div>
            <div class="sv-areas" role="group" aria-label="Go to">
              ${SV_AREAS.map(a => `<button type="button" data-sv-area="${e(a.key)}" class="sv-area-btn" title="${e(a.name)}" aria-label="Go to ${e(a.name)}">${a.key[0] === 'f' ? e(a.icon) : `<span aria-hidden="true">${e(a.icon)}</span><span class="sv-area-txt">${e(a.short)}</span>`}</button>`).join('')}
            </div>
            <button type="button" data-sv="stats" class="sv-btn sv-stats-btn" aria-pressed="false" aria-label="Show his stats panel" title="His stats">📊</button>
            <button type="button" data-sv="list" class="sv-btn" aria-expanded="false" aria-controls="svList" title="Machines here (M)">☰<span class="sv-area-txt"> Machines</span></button>
            <button type="button" data-sv="exit" class="sv-btn sv-exit" title="Leave the Workshop (Esc)">✕<span class="sv-area-txt"> Exit</span></button>
          </div>
          <div class="sv-kelo" role="status" aria-live="polite">
            <span aria-hidden="true">🤖</span><span id="svKeloText" class="sv-kelo-text"></span>
            <button type="button" data-sv="find" class="sv-btn sv-find">Find Kelo-1</button>
          </div>
          <div id="svLift" class="hidden sv-lift" role="group" aria-label="Car elevator">
            <span>🛗 Car elevator: ride to</span>
            ${[1, 2, 3].map(n => `<button type="button" data-sv-floor="${n}" class="sv-btn" aria-label="Ride to floor ${n}">${n}</button>`).join('')}
          </div>
          <div class="sv-help">WASD / arrows walk · drag to look · Shift runs · click a machine · Esc leaves</div>
        </div>
        <div id="svList" class="hidden sv-panel" role="region" aria-labelledby="svListTitle">
          <div class="sv-head">
            <div class="sv-title" id="svListTitle">Machines here</div>
            <button type="button" data-sv="list-close" class="explore-x" aria-label="Close the machines list">✕</button>
          </div>
          <input id="svFilter" type="search" class="sv-filter" placeholder="Filter by name" aria-label="Filter machines by name" autocomplete="off" />
          <div class="sv-chips" role="group" aria-label="Show">
            ${[['all', 'All'], ['run', 'Running'], ['needs', 'Needs'], ['idle', 'Idle'], ['off', 'Off']].map(([k, l]) => `<button type="button" data-sv-chip="${k}" class="sv-chip${k === 'all' ? ' sv-on' : ''}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}
          </div>
          <div id="svListItems" role="list" class="sv-list-items"></div>
        </div>
        <div id="svCard" class="hidden sv-panel" role="region" aria-live="polite" aria-label="Status"></div>
        <div id="svCross" class="hidden" aria-hidden="true"></div>`;
      while (wrap.firstElementChild) host.appendChild(wrap.firstElementChild);
      // (the stats card at the top steps aside on a phone while you visit; 📊 brings it back)
      document.getElementById('worldClockText')?.closest('.pointer-events-auto')?.classList.add('sv-stats-card');

      host.addEventListener('click', ev => {
        // a tap on the small look-at card opens it in full
        if (!shopVisit.pinned && shopVisit.looked && ev.target.closest && ev.target.closest('#svCard')) return svPin(shopVisit.looked);
        const t = ev.target.closest && ev.target.closest('[data-sv], [data-sv-area], [data-sv-floor], [data-sv-chip], [data-sv-go]');
        if (!t || !host.contains(t)) return;
        const act = t.getAttribute('data-sv');
        if (t.hasAttribute('data-sv-area')) return t.closest('#svChooser') ? shopVisitStart(t.getAttribute('data-sv-area')) : svGoArea(t.getAttribute('data-sv-area'));
        if (t.hasAttribute('data-sv-floor')) return svGoFloor(+t.getAttribute('data-sv-floor'));
        if (t.hasAttribute('data-sv-go')) return svGoToTarget(svTargets().find(o => o.key === t.getAttribute('data-sv-go')));
        if (t.hasAttribute('data-sv-chip')) {
          shopVisit.chip = t.getAttribute('data-sv-chip');
          document.querySelectorAll('#svList [data-sv-chip]').forEach(c => { const on = c === t; c.classList.toggle('sv-on', on); c.setAttribute('aria-pressed', String(on)); });
          return svRenderList(true);
        }
        if (act === 'chooser-close') return svCloseChooser();
        if (act === 'exit') return shopVisitExit(true);
        if (act === 'find') return svFindKelo();
        if (act === 'list') return svToggleList();
        if (act === 'list-close') return svToggleList(false);
        if (act === 'card-close') return svPin(null);
        if (act === 'stats') {
          const on = document.body.classList.toggle('sv-stats-on');
          t.setAttribute('aria-pressed', String(on));
          if (typeof exploreFitToPanel === 'function') setTimeout(exploreFitToPanel, 30);
          return;
        }
      });
      document.getElementById('svFilter')?.addEventListener('input', ev => { shopVisit.filter = ev.target.value || ''; svRenderList(true); });
      // Esc closes the chooser (and the list, when typing in its filter)
      document.addEventListener('keydown', ev => {
        if (ev.code !== 'Escape') return;
        const ch = document.getElementById('svChooser');
        if (ch && !ch.classList.contains('hidden')) { svCloseChooser(); ev.stopPropagation(); return; }
        if (ev.target && ev.target.id === 'svFilter') { svToggleList(false); document.querySelector('#svHud [data-sv="list"]')?.focus(); }
      }, true);
      // a click anywhere else closes the chooser
      document.addEventListener('pointerdown', ev => {
        const ch = document.getElementById('svChooser');
        if (ch && !ch.classList.contains('hidden') && !ch.contains(ev.target) && ev.target !== renderer.domElement) svCloseChooser();
      }, true);
      // Shift to run
      const shift = ev => { if (ev.key === 'Shift') shopVisit.shift = ev.type === 'keydown'; };
      window.addEventListener('keydown', shift, true);
      window.addEventListener('keyup', shift, true);
      window.addEventListener('blur', () => { shopVisit.shift = false; });
      // The Workshop's pin offers a visit instead of sending him there
      document.getElementById('poiLabelsContainer')?.addEventListener('click', ev => {
        const pin = typeof poiDomElements !== 'undefined' ? poiDomElements.workshop : null;
        if (!pin || !pin.contains(ev.target)) return;
        ev.stopPropagation();
        shopVisitOpenChooser(ev.clientX, ev.clientY);
      }, true);
    }

window.addEventListener('DOMContentLoaded', () => {
  try { svBuildDom(); } catch (e) { console.warn('shop visit', e); }
});
