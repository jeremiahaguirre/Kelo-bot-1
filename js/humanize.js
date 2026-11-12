// Kelo-bot-1 — js/humanize.js
// Loaded after motion.js. Small, human touches in Kelo-1's body language, layered by
// keloHumanize() inside finishKeloPose() (js/animations.js) on top of his pose, walk and idle life:
//   - he looks where he is going (his target, or the bend in his path ahead), and his head turns
//     toward a new direction a beat before his body does;
//   - he blinks as his head swings round, like people do;
//   - while he talks his hands move with his words, his head nods along and his mouth moves;
//   - waking up he stretches; confused ("hmm?", "I don't know...") he scratches his head;
//   - standing around he fidgets now and then: taps a foot, looks at his hand, rocks on his heels,
//     straightens his antenna, hums a little tune (♪) or lets out a sigh (~) when he is low;
//   - his weight shifts onto one leg with the other knee relaxed;
//   - picking something up or putting it down, he dips at the knees instead of the thing popping.
// Hums and sighs are heard only when sound is already on (js/pastimes.js), and very quietly.

const keloHuman = {
  lastSpeech: '', talkStart: -9, talkUntil: -9, talkW: 0,
  wasResting: false, wakeAt: 0,
  gazeW: 0, gy: 0, gp: 0,
  lastHeadYaw: null, lastSyncBlink: -9, syncBlinks: 0,
  idleSince: 0, nextFidgetAt: 0, fidgets: 0,
  lastCarried: undefined, dipT: -9,
  puffs: [], lastSound: 0,
  pending: null   // an emote to play a moment from now: { name, at }
};

// --- New emotes (playEmote in animations.js plays them by name) ------------------------------------
Object.assign(KELO_EMOTES, {
  // Scratching the side of his head with his right hand, head tilted, puzzled
  scratch: {
    ms: 2600,
    pose(e, r) {
      const up = smoothstep(e / 0.45) * smoothstep(r / 0.45);
      const rub = smoothstep((e - 0.4) / 0.2) * Math.sin(e * 17);
      return {
        // elbow out wide and high, forearm folded back up so his fingers reach behind his ear
        rArmX: -0.35 * up, rArmY: 0, rArmZ: 2.2 * up, rElbowX: -0.1 * up, rElbowZ: 1.65 * up + rub * 0.12,
        rHandZ: rub * 0.18, rHandY: 0.4 * up, rGrip: 0.55,
        headZ: 0.2 * up, headX: -0.06 * up, headY: -0.12 * up, bodyZ: -0.04 * up, lArmZ: -0.12
      };
    }
  },
  // A breath in, shoulders up, then a long breath out with a little slump
  sigh: {
    ms: 2400,
    pose(e) {
      const inhale = e < 0.75 ? smoothstep(e / 0.75) : 1 - smoothstep((e - 0.75) / 0.5);
      const slump = smoothstep((e - 0.7) / 0.6) * (1 - smoothstep((e - 1.8) / 0.6));
      return {
        bodyLift: 0.03 * inhale - 0.03 * slump, bodyX: -0.04 * inhale + 0.13 * slump,
        headX: -0.14 * inhale + 0.3 * slump, lArmZ: -0.16 * inhale - 0.06, rArmZ: 0.16 * inhale + 0.06,
        lArmX: 0.05 * slump, rArmX: 0.05 * slump, lGrip: 0.15, rGrip: 0.15
      };
    }
  },
  // Humming a little tune: his head sways side to side, a small bounce, hands behind his back
  hum: {
    ms: 3400,
    pose(e, r) {
      const w = smoothstep(e / 0.4) * smoothstep(r / 0.4);
      const s = Math.sin(e * 3.6);
      return {
        headZ: 0.13 * s * w, headY: 0.1 * Math.sin(e * 1.8) * w, headX: -0.06 * w, bodyZ: 0.035 * s * w,
        lift: 0.012 * Math.abs(s) * w, lArmX: 0.3 * w, rArmX: 0.3 * w, lArmZ: -0.05, rArmZ: 0.05,
        lElbowX: -0.35 * w, rElbowX: -0.35 * w, lGrip: 0.5, rGrip: 0.5
      };
    }
  },
  // Tapping a foot while he waits, glancing off to one side
  tap: {
    ms: 2600,
    pose(e, r) {
      const w = smoothstep(e / 0.35) * smoothstep(r / 0.35);
      return {
        rLegX: -0.12 * w, rKneeX: 0.14 * w, rFootX: -0.3 * Math.max(0, Math.sin(e * 9)) * w,
        headY: 0.28 * w, headX: -0.04 * w, bodyZ: -0.02 * w, lKneeX: 0.05
      };
    }
  },
  // Looking at his own hand and flexing his fingers
  hands: {
    ms: 3000,
    pose(e, r) {
      const w = smoothstep(e / 0.5) * smoothstep(r / 0.5);
      return {
        lArmX: -0.85 * w, lArmZ: 0.15 * w, lElbowX: -1.25 * w, lHandY: (0.6 + 0.2 * Math.sin(e * 2.2)) * w,
        lGrip: 0.45 + 0.45 * Math.sin(e * 5.5), headX: 0.32 * w, headY: -0.28 * w, headZ: 0.06 * w
      };
    }
  },
  // Rocking gently from heels to toes
  rock: {
    ms: 2800,
    pose(e, r) {
      const w = smoothstep(e / 0.4) * smoothstep(r / 0.4);
      const s = Math.sin(e * 4.4);
      return {
        lFootX: 0.14 * s * w, rFootX: 0.14 * s * w, lift: 0.018 * Math.max(0, s) * w, bodyX: 0.035 * s * w,
        lArmX: 0.28 * w, rArmX: 0.28 * w, lElbowX: -0.3 * w, rElbowX: -0.3 * w, headY: 0.15 * Math.sin(e * 1.3) * w
      };
    }
  },
  // Reaching up to straighten his antenna
  antenna: {
    ms: 2600,
    pose(e, r) {
      const up = smoothstep(e / 0.5) * smoothstep(r / 0.5);
      const twiddle = smoothstep((e - 0.5) / 0.2) * Math.sin(e * 8) * 0.08;
      return {
        rArmX: -0.25 * up, rArmZ: 2.35 * up, rElbowZ: 1.0 * up + twiddle, rElbowX: -0.2 * up, rGrip: 0.7,
        headX: 0.08 * up, headZ: 0.12 * up, headY: -0.1 * up, bodyZ: -0.03 * up
      };
    }
  }
});

const KELO_CONFUSED = /\?\s*$|\bhmm+\b|\bhuh\b|\bi (don'?t|do not) (know|understand|get)\b|\bnot sure\b|\bconfus|\bpuzzl|\bstrange\b|\bweird\b|\bwhat is (this|that)\b|\bno idea\b|\bwonder(ing)? (if|why|how|what)\b/i;
const KELO_SIGHS = /\bsigh\b|\bugh\b|\btired\b|\bexhausted\b|\boh well\b|\bsadly\b|\bmiss(ing)?\b|\blonely\b|\bdidn'?t work\b|\bgave up\b/i;

// Is he talking right now? (The face's mouth moves while he is)
function keloIsTalking(t) {
      return t < keloHuman.talkUntil;
    }

// How open his mouth is while he talks: a scale for its height (js/kelo-body.js)
function keloTalkMouth(t) {
      if (!keloIsTalking(t)) return 1;
      const syll = Math.abs(Math.sin(t * 13) * Math.sin(t * 4.7 + 1));
      return 0.45 + 0.75 * syll;
    }

// --- A little floating "♪" or "~" by his head --------------------------------------------------------
const _keloPuffTex = {};
function keloPuff(text, color = '#fde68a') {
      if (!keloHead || typeof THREE === 'undefined') return;
      const key = text + color;
      if (!_keloPuffTex[key]) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.font = 'bold 84px system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = 'rgba(15,23,42,0.75)';
        g.strokeText(text, 64, 66);
        g.fillStyle = color;
        g.fillText(text, 64, 66);
        _keloPuffTex[key] = new THREE.CanvasTexture(c);
      }
      const mat = new THREE.SpriteMaterial({ map: _keloPuffTex[key], transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(mat);
      sp.scale.setScalar(0.22);
      sp.position.set(0.32, 0.62, 0.05);
      sp.userData.start = keloAnim.lastT || 0;
      keloHead.add(sp);
      keloHuman.puffs.push(sp);
    }

function keloUpdatePuffs(t) {
      keloHuman.puffs = keloHuman.puffs.filter(sp => {
        const e = t - sp.userData.start;
        if (e > 2 || !sp.parent) { if (sp.parent) sp.parent.remove(sp); sp.material.dispose(); return false; }
        sp.position.y = 0.62 + e * 0.16;
        sp.position.x = 0.32 + Math.sin(e * 3) * 0.04;
        sp.material.opacity = Math.min(1, e / 0.25) * (1 - smoothstep((e - 1.3) / 0.7));
        return true;
      });
    }

// A soft hum or sigh, only if sound is already on (he never starts the audio by himself)
function keloSoftSound(kind) {
      try {
        if (state.soundMuted || typeof pastimeAudio === 'undefined' || !pastimeAudio || pastimeAudio.state !== 'running') return;
        const now = Date.now();
        if (now - keloHuman.lastSound < 4000) return;
        keloHuman.lastSound = now;
        const ctx = pastimeAudio, at = ctx.currentTime + 0.02;
        const out = ctx.createGain();
        out.connect(ctx.destination);
        out.gain.setValueAtTime(0.0001, at);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        if (kind === 'hum') {
          // three soft notes with a little vibrato
          [392, 440, 392].forEach((f, i) => osc.frequency.setValueAtTime(f, at + i * 0.32));
          out.gain.exponentialRampToValueAtTime(0.03, at + 0.08);
          out.gain.setValueAtTime(0.03, at + 0.85);
          out.gain.exponentialRampToValueAtTime(0.0001, at + 1.05);
        } else {
          // a breathy falling tone
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, at);
          osc.frequency.exponentialRampToValueAtTime(150, at + 0.9);
          out.gain.exponentialRampToValueAtTime(0.018, at + 0.15);
          out.gain.exponentialRampToValueAtTime(0.0001, at + 0.95);
        }
        osc.connect(out);
        osc.start(at);
        osc.stop(at + 1.1);
      } catch (e) {}
    }

function keloHumanEmote(name) {
      if (!playEmote(name)) return;
      if (name === 'hum') { keloPuff('♪'); keloSoftSound('hum'); }
      if (name === 'sigh') { keloPuff('~', '#cbd5e1'); keloSoftSound('sigh'); }
      if (name === 'scratch') keloPuff('?', '#fcd34d');
    }

// --- Every frame, from finishKeloPose() ----------------------------------------------------------------
// out: the pose channels so far; ctx: { walking, riding, resting, idle, holding, locoOn }
function keloHumanize(out, t, dt, ctx) {
      const h = keloHuman, a = keloAnim;
      const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));

      // What he says: talking time, and the mood of the words
      const said = String(state.speechBubble || '');
      if (said !== h.lastSpeech) {
        h.lastSpeech = said;
        if (said.trim() && !ctx.resting && t > 1) {
          h.talkStart = t;
          h.talkUntil = t + Math.max(1.4, Math.min(6, said.length * 0.055));
          if (KELO_CONFUSED.test(said)) h.pending = { name: 'scratch', at: t + 0.35 };
          else if (KELO_SIGHS.test(said)) h.pending = { name: 'sigh', at: t + 0.2 };
        }
      }
      // Waking up: a big stretch once he is on his feet
      if (h.wasResting && !ctx.resting) h.pending = { name: 'stretch', at: t + 0.7 };
      h.wasResting = ctx.resting;
      if (h.pending && t >= h.pending.at && !ctx.resting) {
        if (!keloEmote || keloEmote.name !== h.pending.name) keloHumanEmote(h.pending.name);
        h.pending = null;
      }
      const talking = keloIsTalking(t) && !ctx.resting;

      // --- Gaze: where he is going, the way he is about to turn, or you when he talks to you
      let want = null;
      if (ctx.walking && ctx.locoOn) {
        const p = state.botPos, tp = state.targetPos;
        const d = Math.hypot(tp.x - p.x, tp.z - p.z);
        const look = d < 9 || !keloMotion.aim ? tp : keloMotion.aim;
        const yaw = wrap(Math.atan2(look.x - p.x, look.z - p.z) - a.yaw);
        // nearly there: glance down at the spot he is walking to
        want = { yaw, pitch: d < 3.5 ? 0.28 * (1 - d / 3.5) : 0.04 };
      } else if (!ctx.walking && !ctx.riding && Math.abs(a.turnErr || 0) > 0.2) {
        want = { yaw: a.turnErr, pitch: 0 };   // about to turn: the head goes first
      } else if (talking && !ctx.riding && typeof camera !== 'undefined' && state.cameraMode !== 'eyes') {
        const dx = camera.position.x - keloGroup.position.x, dz = camera.position.z - keloGroup.position.z;
        const yaw = wrap(Math.atan2(dx, dz) - a.yaw);
        if (Math.abs(yaw) < 1.6) {
          const up = Math.atan2(camera.position.y - (keloGroup.position.y + 2.0), Math.hypot(dx, dz));
          want = { yaw, pitch: Math.max(-0.3, Math.min(0.35, -up * 0.6)) };
        }
      }
      if (want) {
        want.yaw = Math.max(-0.95, Math.min(0.95, want.yaw));
        h.gy = dampTo(h.gy, want.yaw, 9, dt);
        h.gp = dampTo(h.gp, want.pitch, 6, dt);
      }
      h.gazeW = dampTo(h.gazeW, want ? 1 : 0, want ? 6 : 3, dt);
      if (h.gazeW > 0.001) {
        out.headY += h.gy * h.gazeW;
        out.headX += h.gp * h.gazeW;
        out.bodyY += h.gy * 0.12 * h.gazeW;   // a big look turns his shoulders a touch too
        if (talking) { a.lookTarget = { x: 0, y: 0, z: 0 }; a.nextLookAt = Math.max(a.nextLookAt, t + 1.5); }
      }

      // --- Working on something: his head turns to it (the point "through his eyes" looks at,
      // js/eyecam.js), within what his neck turns, over the idle glances
      const fp = !ctx.walking && !ctx.riding && !ctx.resting && typeof keloFocusPoint === 'function' ? keloFocusPoint() : null;
      if (fp) {
        const g = keloGroup.position, eyeY = g.y + KELO_HIP_Y + out.bodyLift + 0.71 + 0.3;
        const fdx = fp.x - g.x, fdz = fp.z - g.z;
        const fyaw = wrap(Math.atan2(fdx, fdz) - a.yaw) - out.bodyY;
        const fpitch = Math.atan2(eyeY - fp.y, Math.max(0.15, Math.hypot(fdx, fdz))) - out.bodyX;
        h.fy = dampTo(h.fy || 0, Math.max(-1.0, Math.min(1.0, fyaw)), 6, dt);
        h.fp = dampTo(h.fp || 0, Math.max(-0.45, Math.min(0.7, fpitch)), 6, dt);
      }
      h.focusW = dampTo(h.focusW || 0, fp ? 0.85 : 0, fp ? 3 : 4, dt);
      if (h.focusW > 0.001) {
        out.headY += (h.fy - out.headY) * h.focusW;
        out.headX += (h.fp - out.headX) * h.focusW;
      }

      // --- Blink as his head swings round
      const headYaw = a.yaw + out.bodyY + out.headY;
      if (h.lastHeadYaw !== null && dt > 0 && typeof keloFace !== 'undefined') {
        const vel = wrap(headYaw - h.lastHeadYaw) / dt;
        if (Math.abs(vel) > 1.5 && t - h.lastSyncBlink > 1.0 && t - keloFace.blinkStart > 0.5) {
          keloFace.blinkStart = t;
          keloFace.nextBlinkAt = t + 2.5 + Math.random() * 3;
          h.lastSyncBlink = t;
          h.syncBlinks++;
        }
      }
      h.lastHeadYaw = headYaw;

      // --- Hands that talk: beats with his words, palms open, now and then both hands
      h.talkW = dampTo(h.talkW, talking && !ctx.holding && !ctx.riding && a.mode !== 'dig' && a.mode !== 'weld' ? (ctx.walking ? 0.45 : 1) : 0, 5, dt);
      if (h.talkW > 0.001) {
        const w = h.talkW, e = t - h.talkStart;
        const beat = Math.sin(e * 5.2) * 0.5 + Math.sin(e * 3.1 + 1) * 0.5;
        const both = smoothstep(Math.sin(e * 1.7 - 0.8) * 1.5);   // the other hand joins for emphasis
        out.rArmX += (-0.5 + 0.1 * beat) * w;
        out.rArmZ += 0.08 * w;
        out.rElbowX += (-0.85 + 0.22 * Math.sin(e * 6.1)) * w;
        out.rHandY += 0.7 * w;
        out.rGrip += (0.1 - out.rGrip) * w;
        out.lArmX += (-0.42 + 0.08 * Math.sin(e * 4.4 + 2)) * w * both;
        out.lArmZ -= 0.08 * w * both;
        out.lElbowX += (-0.8 + 0.18 * Math.sin(e * 5.6 + 1)) * w * both;
        out.lHandY -= 0.7 * w * both;
        out.lGrip += (0.12 - out.lGrip) * w * both;
        out.headX += 0.045 * Math.sin(e * 7.3) * w;   // nodding along
        out.bodyX -= 0.02 * w;
      }

      // --- Weight on one leg: the other knee relaxes, his head stays level
      const sh = a.shift * a.idleW;
      out.lKneeX += Math.max(0, sh) * 0.12;
      out.rKneeX += Math.max(0, -sh) * 0.12;
      out.headZ -= sh * 0.025;

      // --- Waiting around: a little fidget every so often
      if (ctx.idle && !keloEmote && !talking && !ctx.holding) {
        if (!h.idleSince) { h.idleSince = t; h.nextFidgetAt = t + 5 + Math.random() * 5; }
        if (t > h.nextFidgetAt) {
          const happy = (state.happiness ?? 70) >= 75;
          const low = (state.happiness ?? 70) < 45 || (state.fullness ?? 70) < 30 || (state.health ?? 80) < 35;
          const pool = low ? ['sigh', 'sigh', 'tap', 'hands', 'rock']
            : happy ? ['hum', 'hum', 'rock', 'tap', 'hands', 'antenna']
            : ['tap', 'hands', 'rock', 'antenna', 'hum', 'sigh'];
          keloHumanEmote(pool[Math.floor(Math.random() * pool.length)]);
          h.fidgets++;
          h.nextFidgetAt = t + 8 + Math.random() * 10;
        }
      } else if (!ctx.idle) {
        h.idleSince = 0;
      }

      // --- Picking something up or putting it down: dip at the knees, lean in, look at it
      const carried = typeof carriedObject !== 'undefined' ? carriedObject : null;
      if (h.lastCarried !== undefined && carried !== h.lastCarried && !ctx.riding && !ctx.resting) h.dipT = t;
      h.lastCarried = carried;
      const de = t - h.dipT;
      if (de >= 0 && de < 0.8) {
        const w = Math.sin(Math.PI * smoothstep(de / 0.8));
        out.bodyX += 0.32 * w;
        out.headX += 0.25 * w;
        if (!ctx.walking) {
          const drop = 0.15 * w, ang = squatAngle(drop);
          out.lLegX -= ang; out.rLegX -= ang;
          out.lKneeX += 2 * ang; out.rKneeX += 2 * ang;
          out.lift -= drop;
        }
      }

      keloUpdatePuffs(t);
    }
