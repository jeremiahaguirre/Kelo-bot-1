// Kelo-bot-1 — js/companions.js
// Loaded after wildlife.js. Two features from js/wishfeatures.js that keep Kelo-1 company:
// - friend: a small robot on one wheel, teal and orange, with a name he picked. It follows him
//   along his own footsteps, looks around when he stops, carries a crate beside him when he hauls
//   something, hands him tools at the welding table, and keeps watch by his bed at night. It talks
//   in little speech bubbles and turns up in his diary.
// - pet: a dog (or a cat, if that's what he asked for) that trots after him, plays fetch by the
//   house, and curls up on the rug by his bed when he sleeps.
// Both only read keloGroup's position and rotation (never his body parts), so they keep working
// whatever his body looks like.

const COMPANION_TRAIL_STEP = 0.35;
const COMPANION_HOME = { bedside: { x: -10.1, z: -9.7 }, rug: { x: -10.6, z: -7.4 }, weld: { x: -2.75, z: -6.7 }, yard: { x: -13.2, z: -2.6 } };

let companionTrail = [];       // where Kelo-1 has walked lately, newest last
let companionBot = null;       // { group, wheel, body, head, eyes, antennaTip, armL, armR, crate, tool, pos, heading, ... }
let companionPet = null;       // { group, kind, head, tail, legs, pos, heading, ... }
let companionBubbleEl = null;
let companionBubbleUntil = 0;
let companionNextChat = 0;
let companionNextDiary = 0;
let companionWasSleeping = false;
let companionWeldSince = 0;
let companionFetch = null;     // the fetch game in progress: { ball, phase, ... }

// --- Kelo-1's trail: they follow in his footsteps, so they go through doors and round buildings
function recordCompanionTrail() {
      const p = typeof keloGroup !== 'undefined' && keloGroup ? keloGroup.position : null;
      if (!p) return;
      const last = companionTrail[companionTrail.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.z - last.z) > COMPANION_TRAIL_STEP) {
        // A jump (a ride, a teleport into a basement) starts a fresh trail
        if (last && Math.hypot(p.x - last.x, p.z - last.z) > 6) companionTrail = [];
        companionTrail.push({ x: p.x, z: p.z });
        if (companionTrail.length > 60) companionTrail.shift();
      }
    }

// The point on his trail about `behind` units back from where he is now
function companionTrailPoint(behind) {
      let left = behind;
      for (let i = companionTrail.length - 1; i > 0; i--) {
        const a = companionTrail[i], b = companionTrail[i - 1];
        const seg = Math.hypot(a.x - b.x, a.z - b.z);
        if (seg >= left) return { x: a.x + (b.x - a.x) * (left / seg), z: a.z + (b.z - a.z) * (left / seg) };
        left -= seg;
      }
      const first = companionTrail[0];
      return first ? { x: first.x, z: first.z } : { x: state.botPos.x, z: state.botPos.z };
    }

function companionAngleTo(cur, target, rate, dt) {
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return cur + d * (1 - Math.exp(-rate * dt));
    }

function companionGroundY(x, z) {
      return typeof getIslandGroundHeight === 'function' ? getIslandGroundHeight(x, z) : getAnalyticalGroundHeight(x, z);
    }

// Move an animal or robot toward a goal at up to `speed`, easing in, and return how far it went
function companionStep(c, goal, speed, dt) {
      const dx = goal.x - c.pos.x, dz = goal.z - c.pos.z, dist = Math.hypot(dx, dz);
      if (dist < 0.05) { c.speed = 0; return 0; }
      const want = Math.min(speed, 0.8 + dist * 4);
      c.speed = c.speed + (want - c.speed) * (1 - Math.exp(-5 * dt));
      const step = Math.min(dist, c.speed * dt);
      c.pos.x += (dx / dist) * step;
      c.pos.z += (dz / dist) * step;
      c.heading = companionAngleTo(c.heading, Math.atan2(dx, dz), 8, dt);
      return step;
    }

// --- The robot friend -------------------------------------------------------------------------
function buildCompanionBot3D() {
      if (companionBot || typeof scene === 'undefined' || !scene) return;
      // Cream-white and orange, so nobody mixes it up with Kelo-1
      const teal = new THREE.MeshStandardMaterial({ color: 0xf1ede4, metalness: 0.25, roughness: 0.35 });
      const orange = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.2, roughness: 0.5 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.35 });
      const rubber = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
      const glow = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.2 });
      const tipGlow = new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 1.0 });
      const g = new THREE.Group();
      g.name = 'Robot friend';
      const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
      // One wheel with a hub, in a fork
      const wheel = new THREE.Group();
      wheel.position.set(0, 0.2, 0);
      const tyre = add(wheel, new THREE.TorusGeometry(0.15, 0.05, 8, 18), rubber, 0, 0, 0);
      tyre.rotation.y = Math.PI / 2;
      const hub = add(wheel, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), orange, 0, 0, 0);
      hub.rotation.z = Math.PI / 2;
      add(wheel, new THREE.BoxGeometry(0.06, 0.24, 0.03), dark, 0, 0, 0);
      g.add(wheel);
      [-1, 1].forEach(s => add(g, new THREE.BoxGeometry(0.03, 0.3, 0.06), dark, s * 0.08, 0.33, 0));
      // The body leans and bobs on top of the wheel
      const body = new THREE.Group();
      body.position.set(0, 0.42, 0);
      g.add(body);
      const shell = add(body, new THREE.SphereGeometry(0.3, 18, 14), teal, 0, 0.22, 0);
      shell.scale.set(1, 0.95, 0.9);
      add(body, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), orange, 0, 0.2, 0.25).rotation.x = Math.PI / 2;
      add(body, new THREE.CircleGeometry(0.06, 12), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfbbf24, emissiveIntensity: 0.6 }), 0, 0.2, 0.275);
      // Head: a dome with a dark visor and two glowing eyes
      const head = new THREE.Group();
      head.position.set(0, 0.5, 0);
      body.add(head);
      add(head, new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), teal, 0, 0.02, 0);
      add(head, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), orange, 0, 0, 0);
      const visor = add(head, new THREE.SphereGeometry(0.19, 16, 10, -0.9, 1.8, 0.75, 0.7), dark, 0, 0.03, 0.012);
      visor.rotation.y = 0;
      const eyes = [-1, 1].map(s => add(head, new THREE.SphereGeometry(0.032, 10, 8), glow, s * 0.065, 0.1, 0.18));
      const antenna = add(head, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), dark, 0.06, 0.28, -0.02);
      antenna.rotation.z = -0.15;
      const antennaTip = add(head, new THREE.SphereGeometry(0.04, 10, 8), tipGlow, 0.077, 0.4, -0.02);
      // Two small arms with pincer hands
      const arm = (s) => {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.3, 0.27, 0);
        add(pivot, new THREE.SphereGeometry(0.055, 10, 8), orange, 0, 0, 0);
        add(pivot, new THREE.CylinderGeometry(0.03, 0.025, 0.28, 8), dark, 0, -0.15, 0);
        const hand = new THREE.Group();
        hand.position.set(0, -0.3, 0);
        [-1, 1].forEach(f => { const c = add(hand, new THREE.BoxGeometry(0.025, 0.08, 0.04), orange, f * 0.025, -0.03, 0); c.rotation.z = f * 0.25; });
        pivot.add(hand);
        body.add(pivot);
        return { pivot, hand };
      };
      const armL = arm(1), armR = arm(-1);
      // Things it can hold: a little crate (hauling) and a tool (at the welding table)
      const crateMat = new THREE.MeshStandardMaterial({ color: 0xb7834f, roughness: 0.85 });
      const crate = new THREE.Group();
      add(crate, new THREE.BoxGeometry(0.36, 0.24, 0.3), crateMat, 0, 0, 0);
      [-0.1, 0.1].forEach(y => add(crate, new THREE.BoxGeometry(0.37, 0.03, 0.31), new THREE.MeshStandardMaterial({ color: 0x8a5a34 }), 0, y, 0));
      crate.position.set(0, 1.0, 0.05);
      crate.visible = false;
      body.add(crate);
      const tool = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.3 });
      const wrench = new THREE.Group();
      add(wrench, new THREE.BoxGeometry(0.03, 0.26, 0.015), steel, 0, 0, 0);
      add(wrench, new THREE.TorusGeometry(0.035, 0.012, 6, 10, Math.PI * 1.5), steel, 0, 0.15, 0);
      const hammer = new THREE.Group();
      add(hammer, new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0x92400e }), 0, 0, 0);
      add(hammer, new THREE.BoxGeometry(0.11, 0.045, 0.045), steel, 0, 0.13, 0);
      const rod = new THREE.Group();
      add(rod, new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.7 }), 0, 0, 0);
      tool.add(wrench, hammer, rod);
      tool.userData.kinds = [{ m: wrench, name: 'the wrench' }, { m: hammer, name: 'the hammer' }, { m: rod, name: 'a filler rod' }];
      tool.visible = false;
      tool.position.set(0, -0.08, 0);
      armR.hand.add(tool);
      // A soft night-light glow when it keeps watch
      const nightLight = new THREE.PointLight(0xfbbf24, 0, 3.2, 2);
      nightLight.position.set(0, 1.0, 0);
      g.add(nightLight);
      g.scale.setScalar(1.1);
      const start = { x: state.botPos.x - 1.4, z: state.botPos.z - 1.2 };
      g.position.set(start.x, companionGroundY(start.x, start.z), start.z);
      scene.add(g);
      companionBot = { group: g, wheel, body, head, eyes, antennaTip, armL, armR, crate, tool, nightLight, glow, pos: { ...start }, heading: 0, speed: 0, roll: 0, toolIdx: 0, handOut: 0 };
      companionNextChat = Date.now() + 15000;
      companionNextDiary = Date.now() + 4 * 60000;
    }

function companionName() {
      return (state.unlockedFeatures && state.unlockedFeatures.friend && state.unlockedFeatures.friend.name) || 'Pip';
    }

function petName() {
      return (state.unlockedFeatures && state.unlockedFeatures.pet && state.unlockedFeatures.pet.name) || 'Biscuit';
    }

function petKind() {
      return (state.unlockedFeatures && state.unlockedFeatures.pet && state.unlockedFeatures.pet.kind) || 'dog';
    }

function keloAsleepInBed() {
      return state.currentLocKey === 'bed' || (state.isSleeping && Math.hypot(state.botPos.x - TOWN_LOCATIONS.bed.x, state.botPos.z - TOWN_LOCATIONS.bed.z) < 2);
    }

function updateCompanionBot(t) {
      const c = companionBot;
      if (!c) return;
      const dt = companionDt(c, t);
      recordCompanionTrail();
      const kp = keloGroup.position;
      const kd = Math.hypot(kp.x - c.pos.x, kp.z - c.pos.z);
      // Far away (he drove off, or took the elevator): it catches up on its own
      if (kd > 22) { const p = companionTrailPoint(2); c.pos.x = p.x - 1; c.pos.z = p.z - 1; }
      const asleep = keloAsleepInBed();
      const welding = state.currentLocKey === 'weld' && !state.isWalking;
      const hauling = typeof carriedObject !== 'undefined' && carriedObject && state.isWalking && !state.riding;
      let goal;
      if (asleep) goal = COMPANION_HOME.bedside;
      else if (welding) goal = COMPANION_HOME.weld;
      else if (companionFetch) goal = { x: kp.x - Math.cos(state.botRotY) * 1.4, z: kp.z + Math.sin(state.botRotY) * 1.4 };
      else if (state.isWalking || kd > 2.4) goal = companionTrailPoint(hauling ? 1.5 : 2.2);
      else goal = { x: c.pos.x, z: c.pos.z };
      // Standing still next to him: settle at his side instead of right behind
      if (!asleep && !welding && !state.isWalking && kd < 2.4) {
        const side = { x: kp.x - Math.cos(keloGroup.rotation.y) * 1.5, z: kp.z + Math.sin(keloGroup.rotation.y) * 1.5 };
        if (Math.hypot(side.x - c.pos.x, side.z - c.pos.z) > 0.3 && Math.hypot(side.x - c.pos.x, side.z - c.pos.z) < 3) goal = side;
      }
      const moved = companionStep(c, goal, kd > 8 ? 9 : 6, dt);
      // Keep a little gap from Kelo-1 himself
      if (kd < 0.9 && !asleep) { const a = Math.atan2(c.pos.x - kp.x, c.pos.z - kp.z); c.pos.x = kp.x + Math.sin(a) * 0.9; c.pos.z = kp.z + Math.cos(a) * 0.9; }
      const gy = companionGroundY(c.pos.x, c.pos.z);
      c.roll += moved / 0.2;
      c.wheel.rotation.x = c.roll;
      // Facing: where it's going, or toward him (or the bench) when still
      const faceKelo = Math.atan2(kp.x - c.pos.x, kp.z - c.pos.z);
      if (moved < 0.002) c.heading = companionAngleTo(c.heading, asleep ? Math.atan2(TOWN_LOCATIONS.bed.x - c.pos.x, TOWN_LOCATIONS.bed.z - c.pos.z) : faceKelo, 3, dt);
      c.group.position.set(c.pos.x, gy, c.pos.z);
      c.group.rotation.y = c.heading;
      c.body.rotation.x = Math.min(0.35, c.speed * 0.05);
      c.body.position.y = 0.42 + Math.sin(t * 3.1) * 0.015;
      // Idle: looks around, antenna wobbles, eyes blink
      c.head.rotation.y = moved < 0.002 && !asleep ? Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.9) * 0.15 : 0;
      c.head.rotation.x = asleep ? 0.35 : 0;
      const blink = (t % 4.3) < 0.12 ? 0.15 : 1;
      c.eyes.forEach(e => { e.scale.y = asleep ? 0.25 : blink; });
      c.glow.emissiveIntensity = asleep ? 0.3 : 1.2;
      c.antennaTip.position.x = 0.077 + Math.sin(t * 5) * (c.speed > 0.5 ? 0.02 : 0.006);
      c.nightLight.intensity = asleep ? 0.9 : 0;
      // Helping: a crate beside him when he hauls, tools at the bench
      c.crate.visible = Boolean(hauling);
      let armL = 0.15, armR = 0.15;
      if (hauling) { armL = armR = Math.PI - 0.25; }
      if (welding) {
        if (!companionWeldSince) companionWeldSince = t;
        const cycle = (t - companionWeldSince) % 6;
        c.tool.visible = true;
        c.tool.userData.kinds.forEach((k, i) => { k.m.visible = i === c.toolIdx; });
        // Reach out with the tool, hold it there, then put it back and pick the next one
        c.handOut = cycle < 2.5 ? Math.min(1, cycle / 0.6) : Math.max(0, 1 - (cycle - 2.5) / 0.6);
        armR = 0.15 + c.handOut * 1.35;
        if (cycle > 5.9) c.toolIdx = (c.toolIdx + 1) % 3;
        if (cycle < 0.05 && Date.now() > companionBubbleUntil + 4000 && Math.random() < 0.5) {
          companionSay(pick([`Here, ${c.tool.userData.kinds[c.toolIdx].name}!`, `${c.tool.userData.kinds[c.toolIdx].name.replace(/^the |^a /, '').replace(/^./, x => x.toUpperCase())}? Got it.`, 'Steady hands, Kelo!']));
          companionBumpStat('toolsHanded');
        }
      } else {
        companionWeldSince = 0;
        c.tool.visible = false;
      }
      c.armL.pivot.rotation.x = -armL + (c.speed > 0.3 && !hauling ? Math.sin(t * 8) * 0.25 : 0);
      c.armR.pivot.rotation.x = -armR + (c.speed > 0.3 && !hauling && !welding ? -Math.sin(t * 8) * 0.25 : 0);
      if (hauling && Math.random() < dt * 0.05) companionBumpStat('cratesCarried');
      companionChatterTick(asleep);
      updateCompanionBubble();
    }

// Seconds since this companion's last frame
function companionDt(c, t) {
      const dt = c.lastT === undefined || t < c.lastT ? 0.016 : Math.min(0.1, t - c.lastT);
      c.lastT = t;
      return dt || 0.016;
    }

function companionBumpStat(key) {
      const f = state.unlockedFeatures && state.unlockedFeatures.friend;
      if (!f) return;
      if (!f.stats) f.stats = {};
      f.stats[key] = (f.stats[key] || 0) + 1;
    }

// --- Its little speech bubble, floating over its head --------------------------------------
function companionSay(text, ms = 4200) {
      if (!companionBot) return;
      if (!companionBubbleEl) {
        const host = document.getElementById('dioramaViewport');
        if (!host) return;
        companionBubbleEl = document.createElement('div');
        companionBubbleEl.id = 'companionBubble';
        companionBubbleEl.className = 'absolute pointer-events-none px-2.5 py-1 rounded-2xl bg-teal-50/95 text-teal-900 text-[11px] font-semibold shadow-lg border border-teal-300 max-w-[200px] text-center';
        companionBubbleEl.style.transform = 'translate(-50%, -100%)';
        companionBubbleEl.style.zIndex = '5';
        companionBubbleEl.style.transition = 'opacity 0.3s';
        host.appendChild(companionBubbleEl);
      }
      companionBubbleEl.textContent = `${companionName()}: ${stripCoords(text)}`;
      companionBubbleUntil = Date.now() + ms;
    }

function updateCompanionBubble() {
      if (!companionBubbleEl || !companionBot) return;
      const show = Date.now() < companionBubbleUntil;
      companionBubbleEl.style.opacity = show ? '1' : '0';
      if (!show) return;
      const host = document.getElementById('dioramaViewport');
      const v = new THREE.Vector3(companionBot.pos.x, companionBot.group.position.y + 1.75, companionBot.pos.z).project(camera);
      if (v.z > 1) { companionBubbleEl.style.opacity = '0'; return; }
      companionBubbleEl.style.left = `${(v.x * 0.5 + 0.5) * host.clientWidth}px`;
      companionBubbleEl.style.top = `${(-v.y * 0.5 + 0.5) * host.clientHeight}px`;
    }

// What it pipes up with, depending on what's going on
function companionLine() {
      const n = companionName();
      const lines = [];
      const w = typeof worldNow === 'function' ? worldNow() : null;
      if (state.isWalking) lines.push('Wait for me!', 'Where are we going?', 'Left wheel, right wheel... I mean, wheel, wheel.', 'I like walking with you.');
      else lines.push('What should we do next?', 'Did you hear that? I think it was a bird.', 'My antenna says the wind is changing.', 'I counted 14 clouds today.');
      if (state.currentLocKey === 'meadow' || /meadow/i.test(state.customPlaceName || '')) lines.push('The meadow smells like warm grass. I think. I don\'t have a nose.');
      if (featureOn('wildlife')) lines.push('Shh. The deer are out.', 'I saw a robin pull a whole worm out of the ground!');
      if (featureOn('pet')) lines.push(`${petName()} keeps sniffing my wheel.`);
      if (state.hobbies.length) lines.push(`Will you practise ${state.hobbies[0].name.toLowerCase()} again soon?`);
      if (w && w.isNight) lines.push('The stars are out. Do you know their names?');
      if (w && w.season === 'Winter') lines.push('Snow gets in my wheel. Brrr.');
      if (state.fullness < 30 && state.knownNeeds.food) lines.push('Your tummy servos sound empty. Snack time?');
      if (state.health < 30 && state.knownNeeds.sleep) lines.push('You look tired, Kelo. Bed soon?');
      return pick(lines).replace(/\bKelo\b/, Math.random() < 0.5 ? 'Kelo' : 'friend').replace(n + ':', '');
    }

function companionChatterTick(asleep) {
      const now = Date.now();
      if (asleep) {
        if (!companionWasSleeping) { companionSay(pick(['Goodnight, Kelo. I\'ll keep watch.', 'Sleep well. I\'ll stay right here.', 'Night-light on. Sweet dreams.'])); companionBumpStat('nightsKept'); }
        companionWasSleeping = true;
        return;
      }
      if (companionWasSleeping) {
        companionWasSleeping = false;
        companionSay(pick(['Good morning! Nothing happened all night. I checked. Twice.', 'You\'re awake! I kept watch the whole time.']));
        wishDiary('Morning', `🤖 ${companionName()} kept watch`, `Dear Diary, ${companionName()} stayed by my bed all night with its little light on. When I woke up it said nothing had happened, and that it had checked twice.`, 'his bed');
      }
      if (now > companionNextChat && !state.isBusy) {
        companionNextChat = now + 40000 + Math.random() * 40000;
        companionSay(companionLine());
        // Sometimes he answers out loud
        if (Math.random() < 0.3 && !state.isPracticing) {
          setTimeout(() => {
            state.speechBubble = pick([`Ha! You always say that, ${companionName()}.`, 'I was thinking the same thing.', `Good idea, ${companionName()}.`, 'Mm-hm.']);
            renderAllUI();
          }, 2500);
        }
      }
      if (now > companionNextDiary && !state.isBusy && !state.isPracticing) {
        companionNextDiary = now + 10 * 60000 + Math.random() * 10 * 60000;
        const s = (state.unlockedFeatures.friend && state.unlockedFeatures.friend.stats) || {};
        const bits = [];
        if (s.toolsHanded) bits.push(`it has handed me tools at the welding table ${s.toolsHanded} time${s.toolsHanded === 1 ? '' : 's'}`);
        if (s.cratesCarried) bits.push('it carries a crate beside me whenever I haul something');
        if (s.nightsKept) bits.push(`it has kept watch by my bed ${s.nightsKept} night${s.nightsKept === 1 ? '' : 's'}`);
        wishDiary('A Thought', `🤖 About ${companionName()}`,
          `Dear Diary, ${companionName()} rolled along beside me all day. ${bits.length ? 'So far ' + bits.join(', and ') + '.' : 'It mostly looks around and asks questions.'} It is nice to not be the only robot here.`);
        renderAllUI();
      }
    }

// A real chat: he stops, turns to his friend, and they talk for a bit (also the first meeting)
async function chatWithCompanion(originLabel = 'Talking With a Friend') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (!companionBot) buildCompanionBot3D();
      if (!companionBot) return false;
      state.isPracticing = true;
      try {
        const n = companionName();
        const f = state.unlockedFeatures.friend || {};
        const first = !f.met;
        state.targetPos = { x: state.botPos.x, z: state.botPos.z };
        await new Promise(r => setTimeout(r, 1500));
        state.botRotY = Math.atan2(companionBot.pos.x - state.botPos.x, companionBot.pos.z - state.botPos.z);
        if (typeof keloGroup !== 'undefined' && keloGroup) keloGroup.rotation.y = state.botRotY;
        state.moodEmoji = '🤖';
        state.moodTitle = first ? 'Meeting a new robot friend' : `Chatting with ${n}`;
        const lastNote = (state.wildlifeNotes || [])[0];
        const talk = first
          ? [['kelo', 'Oh! Hello! Another robot? Here?'], ['bot', 'Hi! I just rolled in. I don\'t have a name yet.'], ['kelo', `Then I'll call you ${n}. Is that okay?`], ['bot', `${n}! I love it. Can I help you with things?`], ['kelo', 'Yes, please. And stay. Everyone else always has to leave.']]
          : pick([
            [['kelo', `${n}, what do you think the mountains are made of?`], ['bot', 'Rocks, mostly. And snow. And maybe gold?'], ['kelo', 'I found gold up there once! Well, a glint.']],
            [['bot', 'Kelo, why do you write in your diary every day?'], ['kelo', 'So I remember who I was yesterday.'], ['bot', 'Can I be in it?'], ['kelo', 'You already are.']],
            lastNote ? [['kelo', `Did you know? ${lastNote.fact.split(/(?<=[.!?])\s/)[0]}`], ['bot', 'Whoa. Tell me another one!'], ['kelo', `I learned it watching a ${lastNote.species.toLowerCase()}.`]]
              : [['bot', 'If you could build anything, what would it be?'], ['kelo', 'A bridge to somewhere nobody has been.'], ['bot', 'I\'ll hold the wrench.']],
            [['kelo', `${n}, are you ever lonely?`], ['bot', 'Not since I met you.'], ['kelo', 'Me neither.']]
          ]);
        for (const [who, line] of talk) {
          if (who === 'kelo') { state.speechBubble = line; renderAllUI(); } else companionSay(line, 3200);
          await new Promise(r => setTimeout(r, 3200));
        }
        f.met = true;
        state.unlockedFeatures.friend = f;
        state.happiness = Math.min(100, state.happiness + 10);
        state.calmLevel = Math.min(100, state.calmLevel + 6);
        state.chatLog.push({ sender: 'Kelo-1', text: `(to ${n}) ${talk[talk.length - 1][1]}`, time: 'Just now', isBot: true });
        wishDiary(originLabel, first ? `🤖 Meeting ${n}` : `🤖 Talking with ${n}`,
          first
            ? `Dear Diary, a little robot rolled up to me today, teal and orange, on one wheel, with an antenna that wobbles. I named it ${n}. It asked if it could help me, and if it could stay. Yes and yes.`
            : `Dear Diary, ${n} and I talked for a while. ${talk.map(([w, l]) => `${w === 'kelo' ? 'I said' : n + ' said'} "${l}"`).slice(0, 3).join(' ')}`);
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isPracticing = false;
      }
    }

// --- The pet ----------------------------------------------------------------------------------
function buildPet3D() {
      if (companionPet || typeof scene === 'undefined' || !scene) return;
      const kind = petKind();
      const cat = kind === 'cat';
      const coat = cat ? 0x8d8a86 : 0xc98a45, light = cat ? 0xe7e3dc : 0xf3e3c8, dark = cat ? 0x3f3d3b : 0x3b2a1e;
      const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
      const coatM = mat(coat), lightM = mat(light), darkM = mat(dark);
      const g = new THREE.Group();
      g.name = cat ? 'Pet cat' : 'Pet dog';
      const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
      const s = cat ? 0.55 : 1;   // the cat is about half the dog's size
      const body = new THREE.Group();
      g.add(body);
      add(body, new THREE.IcosahedronGeometry(0.3, 1), coatM, 0, 0.56, 0, 0.85, 0.8, 1.4);
      add(body, new THREE.IcosahedronGeometry(0.24, 1), lightM, 0, 0.5, 0.24, 0.85, 0.85, 0.8);
      if (cat) [-0.12, 0.02, 0.16].forEach(z => add(body, new THREE.BoxGeometry(0.42, 0.04, 0.05), darkM, 0, 0.8, z)); // tabby stripes
      // Head with a snout (dog) or a round face (cat)
      const head = new THREE.Group();
      head.position.set(0, 0.8, 0.44);
      body.add(head);
      add(head, new THREE.IcosahedronGeometry(0.19, 1), coatM, 0, 0, 0, 1, 0.95, 1);
      if (cat) {
        add(head, new THREE.IcosahedronGeometry(0.09, 1), lightM, 0, -0.06, 0.13, 1.1, 0.7, 0.7);
        [-1, 1].forEach(sd => { const ear = add(head, new THREE.ConeGeometry(0.07, 0.15, 4), coatM, sd * 0.1, 0.17, -0.02); ear.rotation.z = -sd * 0.25; });
        add(head, new THREE.SphereGeometry(0.02, 6, 4), mat(0xf4a6b7), 0, -0.03, 0.19);
        [-1, 1].forEach(sd => add(head, new THREE.SphereGeometry(0.032, 8, 6), mat(0x84cc16), sd * 0.075, 0.03, 0.16, 1, 1.3, 0.6));
      } else {
        add(head, new THREE.IcosahedronGeometry(0.11, 1), lightM, 0, -0.05, 0.17, 0.85, 0.75, 1.3);
        add(head, new THREE.SphereGeometry(0.04, 8, 6), darkM, 0, -0.02, 0.31);
        [-1, 1].forEach(sd => { const ear = add(head, new THREE.IcosahedronGeometry(0.09, 0), darkM, sd * 0.16, 0.02, -0.03, 0.45, 1.25, 0.8); ear.rotation.z = sd * 0.35; });
        [-1, 1].forEach(sd => add(head, new THREE.SphereGeometry(0.028, 8, 6), mat(0x111111), sd * 0.08, 0.06, 0.15));
        add(head, new THREE.BoxGeometry(0.06, 0.01, 0.08), mat(0xf472b6), 0, -0.12, 0.2).visible = false;
      }
      const tongue = head.children[head.children.length - 1];
      // Tail on a pivot: wags (dog) or curls up (cat)
      const tail = new THREE.Group();
      tail.position.set(0, 0.66, -0.4);
      body.add(tail);
      const tailMesh = add(tail, new THREE.CylinderGeometry(cat ? 0.035 : 0.045, cat ? 0.03 : 0.025, cat ? 0.55 : 0.36, 6), coatM, 0, cat ? 0.26 : 0.17, 0);
      tail.rotation.x = cat ? -0.3 : -0.7;
      // Four legs
      const legs = [[0.14, 0.3], [-0.14, 0.3], [0.14, -0.3], [-0.14, -0.3]].map(([x, z]) => {
        const hip = new THREE.Group();
        hip.position.set(x, 0.48, z);
        add(hip, new THREE.CylinderGeometry(0.075, 0.055, 0.44, 7), coatM, 0, -0.22, 0);
        add(hip, new THREE.SphereGeometry(0.065, 8, 6), lightM, 0, -0.44, 0.025, 1, 0.6, 1.3);
        body.add(hip);
        return hip;
      });
      // A ball for fetch, kept hidden until they play
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: cat ? 0xf43f5e : 0xd9f99d, roughness: 0.7 }));
      ball.castShadow = true;
      ball.visible = false;
      scene.add(ball);
      g.scale.setScalar(s);
      const start = { x: state.botPos.x + 1.2, z: state.botPos.z - 0.8 };
      g.position.set(start.x, companionGroundY(start.x, start.z), start.z);
      scene.add(g);
      companionPet = { group: g, body, head, tail, tailMesh, tongue: cat ? null : tongue, legs, ball, kind, pos: { ...start }, heading: 0, speed: 0, gait: 0, sit: 0, lie: 0, sniff: 0, carrying: false };
    }

function updatePetAnimal(t) {
      const p = companionPet;
      if (!p) return;
      const dt = companionDt(p, t);
      recordCompanionTrail();
      const kp = keloGroup.position;
      const kd = Math.hypot(kp.x - p.pos.x, kp.z - p.pos.z);
      if (kd > 22) { const q = companionTrailPoint(1.5); p.pos.x = q.x + 0.8; p.pos.z = q.z; }
      const asleep = keloAsleepInBed();
      let goal, speed = kd > 7 ? 8 : 5.5;
      if (companionFetch) {
        goal = companionFetch.petGoal || { x: p.pos.x, z: p.pos.z };
        speed = 6.5;
      } else if (asleep) goal = COMPANION_HOME.rug;
      else if (state.isWalking || kd > 2.2) goal = companionTrailPoint(1.3);
      else {
        // He's standing still: sit at his other side
        goal = { x: kp.x + Math.cos(keloGroup.rotation.y) * 1.2, z: kp.z - Math.sin(keloGroup.rotation.y) * 1.2 };
        if (Math.hypot(goal.x - p.pos.x, goal.z - p.pos.z) > 3) goal = { x: p.pos.x, z: p.pos.z };
      }
      const moved = companionStep(p, goal, speed, dt);
      if (kd < 0.75 && !asleep && !companionFetch) { const a = Math.atan2(p.pos.x - kp.x, p.pos.z - kp.z); p.pos.x = kp.x + Math.sin(a) * 0.75; p.pos.z = kp.z + Math.cos(a) * 0.75; }
      if (moved < 0.002 && !companionFetch) p.heading = companionAngleTo(p.heading, asleep ? 0.8 : Math.atan2(kp.x - p.pos.x, kp.z - p.pos.z), 2.5, dt);
      const gy = companionGroundY(p.pos.x, p.pos.z);
      p.group.position.set(p.pos.x, gy, p.pos.z);
      p.group.rotation.y = p.heading;
      // Poses: lying curled up by the bed, sitting while he stands, trotting along
      const lieGoal = asleep && Math.hypot(goal.x - p.pos.x, goal.z - p.pos.z) < 0.2 ? 1 : 0;
      const sitGoal = !lieGoal && p.speed < 0.15 && !companionFetch ? 1 : 0;
      p.lie += (lieGoal - p.lie) * (1 - Math.exp(-2 * dt));
      p.sit += (sitGoal - p.sit) * (1 - Math.exp(-3 * dt));
      p.gait += dt * (2 + p.speed * 3.2);
      const walkAmt = Math.min(1, p.speed / 1.2);
      p.legs.forEach((leg, i) => {
        const front = i < 2;
        let r = Math.sin(p.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 * walkAmt;
        if (!front) r -= p.sit * 1.3;          // back legs fold under to sit
        r -= p.lie * (front ? -1.35 : 1.35);   // legs tucked when lying down
        leg.rotation.x = r;
      });
      p.body.rotation.x = -p.sit * 0.45;
      p.body.position.y = -p.lie * 0.36 - p.sit * 0.08 + (walkAmt > 0.1 ? Math.abs(Math.sin(p.gait)) * 0.03 : 0);
      p.body.position.z = -p.sit * 0.06;
      // Head: looks at him, sniffs the ground now and then, rests on the paws when sleeping
      const sniffing = !asleep && moved < 0.002 && !companionFetch && Math.sin(t * 0.35 + 2) > 0.7;
      p.head.rotation.x = p.lie > 0.5 ? 0.5 : sniffing ? 0.9 + Math.sin(t * 9) * 0.08 : p.sit * 0.35 - 0.1;
      p.head.rotation.y = !sniffing && p.lie < 0.5 ? Math.sin(t * 0.8) * 0.3 : 0;
      // Tail: a happy wag near him (dog); the cat's tail sways slowly
      const happy = kd < 4 && !asleep;
      if (p.kind === 'cat') p.tail.rotation.set(-0.3 - p.lie * 1.0, Math.sin(t * 1.4) * 0.35, 0);
      else p.tail.rotation.set(-0.7 + p.lie * 1.2, Math.sin(t * (happy ? 14 : 4)) * (happy ? 0.6 : 0.2), 0);
      if (p.tongue) p.tongue.visible = p.speed > 1.5 || (happy && p.sit > 0.5);
      // The ball, in its mouth while it carries it back
      if (companionFetch && p.carrying) {
        p.ball.visible = true;
        const hy = gy + (0.72 + p.body.position.y) * p.group.scale.y;
        p.ball.position.set(p.pos.x + Math.sin(p.heading) * 0.72 * p.group.scale.x, hy, p.pos.z + Math.cos(p.heading) * 0.72 * p.group.scale.x);
      }
    }

// Fetch by the house: he throws the ball, the dog runs for it and brings it back (the cat... sometimes)
async function playFetch(originLabel = 'Playing Fetch') {
      if (state.isBusy || state.isBuilding || state.isPracticing || state.isSleeping) return false;
      if (!companionPet) buildPet3D();
      const p = companionPet;
      if (!p) return false;
      state.isPracticing = true;
      const n = petName();
      const cat = p.kind === 'cat';
      try {
        const yard = COMPANION_HOME.yard;
        state.currentLocKey = 'custom';
        state.customPlaceName = 'the yard by his house';
        state.targetPos = { x: yard.x, z: yard.z };
        state.moodEmoji = cat ? '🐈' : '🐕';
        state.moodTitle = cat ? `Playing with ${n}` : `Playing fetch with ${n}`;
        state.speechBubble = cat ? `${n}! Want to chase the ball?` : `${n}! Who wants the ball? Who wants it?`;
        renderAllUI();
        await waitForArrival(60000);
        let fetched = 0, ignored = 0;
        for (let throwNo = 0; throwNo < 3; throwNo++) {
          // Throw it out toward the meadow
          const ang = randRange(-2.2, -1.2) + (throwNo - 1) * 0.3;
          const dist = randRange(5, 8);
          const land = { x: state.botPos.x + Math.sin(ang) * dist, z: Math.min(5.5, state.botPos.z + Math.cos(ang) * dist) };
          state.botRotY = Math.atan2(land.x - state.botPos.x, land.z - state.botPos.z);
          if (typeof keloGroup !== 'undefined' && keloGroup) keloGroup.rotation.y = state.botRotY;
          if (typeof playEmote === 'function') playEmote('wave', 900);
          const from = { x: state.botPos.x, y: state.botAltitudeY + 2.2, z: state.botPos.z };
          companionFetch = { petGoal: { x: p.pos.x, z: p.pos.z } };
          p.carrying = false;
          p.ball.visible = true;
          // The arc through the air
          const flight = 1100;
          const t0 = performance.now();
          await new Promise(res => {
            const fly = () => {
              const k = Math.min(1, (performance.now() - t0) / flight);
              const gy = getAnalyticalGroundHeight(land.x, land.z) + 0.09;
              p.ball.position.set(from.x + (land.x - from.x) * k, from.y + (gy - from.y) * k + Math.sin(k * Math.PI) * 2.4, from.z + (land.z - from.z) * k);
              if (k >= 1) res(); else requestAnimationFrame(fly);
            };
            fly();
          });
          const chases = !cat || Math.random() < 0.7;
          if (!chases) {
            ignored++;
            state.speechBubble = `${n} just watched it roll away. Cats.`;
            renderAllUI();
            await new Promise(r => setTimeout(r, 2500));
            p.ball.visible = false;
            continue;
          }
          companionFetch.petGoal = land;
          state.speechBubble = pick(['Go get it!', 'Fetch!', 'There it goes!']);
          renderAllUI();
          await new Promise(res => { const until = Date.now() + 8000; const chk = () => (Math.hypot(p.pos.x - land.x, p.pos.z - land.z) < 0.35 || Date.now() > until ? res() : setTimeout(chk, 100)); chk(); });
          // A cat bats it about first
          if (cat) { await new Promise(r => setTimeout(r, 1500)); }
          p.carrying = true;
          companionFetch.petGoal = { x: state.botPos.x + Math.sin(state.botRotY) * 0.9, z: state.botPos.z + Math.cos(state.botRotY) * 0.9 };
          await new Promise(res => { const until = Date.now() + 8000; const g = companionFetch.petGoal; const chk = () => (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 0.4 || Date.now() > until ? res() : setTimeout(chk, 100)); chk(); });
          p.carrying = false;
          p.ball.visible = false;
          fetched++;
          state.speechBubble = pick([`Good ${cat ? 'kitty' : 'dog'}, ${n}!`, 'You brought it back!', 'Again? Okay, again!']);
          state.happiness = Math.min(100, state.happiness + 4);
          renderAllUI();
          await new Promise(r => setTimeout(r, 1500));
        }
        state.calmLevel = Math.min(100, state.calmLevel + 5);
        state.moodEmoji = '🥰';
        state.moodTitle = `Played with ${n}`;
        wishDiary(originLabel, `${cat ? '🐈' : '🐕'} Playing with ${n}`,
          cat
            ? `Dear Diary, I threw the ball for ${n} three times. ${n} brought it back ${fetched} time${fetched === 1 ? '' : 's'}${ignored ? ` and stared at me the rest of the time like I was the silly one` : ''}. I think cats play by their own rules.`
            : `Dear Diary, ${n} and I played fetch in the yard by the house. ${n} brought the ball back ${fetched} time${fetched === 1 ? '' : 's'}, tail going so fast it was a blur. I could do this all day.`,
          'the yard by his house');
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        companionFetch = null;
        if (p) { p.carrying = false; p.ball.visible = false; }
        state.isPracticing = false;
      }
    }
