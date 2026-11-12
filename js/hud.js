// Kelo-bot-1 — js/hud.js
// The screen over the 3D world: which controls show for the camera mode, the needs pop-up in the
// status block, "Where is Kelo-1?" only when he is out of view, and the Eyes note fading away.
// It only toggles classes and attributes when something changed (four checks a second).

const hudView = { mode: '', away: null, eyes: false, eyesTimer: 0, eyesHover: false };
const hudProjected = new THREE.Vector3();
const HUD_EYES_FADE_MS = 4000;

// Is Kelo-1 outside the picture (behind the camera or past an edge)?
function hudKeloOutOfView() {
      if (typeof camera === 'undefined' || !camera || typeof exploreKeloSpot !== 'function') return false;
      exploreKeloSpot(hudProjected).project(camera);
      return hudProjected.z > 1 || Math.abs(hudProjected.x) > 0.95 || Math.abs(hudProjected.y) > 0.95;
    }

function hudTick() {
      const body = document.body;
      const mode = String(state.cameraMode || 'follow');
      if (mode !== hudView.mode) {
        hudView.mode = mode;
        body.setAttribute('data-cam', mode === 'follow' || mode === 'eyes' ? mode : 'explore');
        const focus = document.getElementById('btnFocusKelo');
        if (focus) focus.setAttribute('aria-pressed', String(mode === 'follow'));
      }
      // "Where is Kelo-1?" while exploring, or when following has lost him; never from his own eyes
      const away = mode !== 'eyes' && (mode !== 'follow' || hudKeloOutOfView());
      if (away !== hudView.away) {
        hudView.away = away;
        body.classList.toggle('hud-kelo-away', away);
      }
      const eyes = body.classList.contains('eyecam-on');
      if (eyes !== hudView.eyes) {
        hudView.eyes = eyes;
        if (eyes) hudEyesWake();
      }
    }

// The Eyes note shows in full for a few seconds, then fades until it is hovered, focused or tapped
function hudEyesWake() {
      const hud = document.getElementById('eyeCamHud');
      if (!hud) return;
      hud.classList.remove('hud-eyes-faded');
      clearTimeout(hudView.eyesTimer);
      hudView.eyesTimer = setTimeout(() => {
        if (hudView.eyesHover || hud.contains(document.activeElement)) return;
        hud.classList.add('hud-eyes-faded');
      }, HUD_EYES_FADE_MS);
    }

function hudSetNeedsOpen(open) {
      const btn = document.getElementById('hudNeedsBtn');
      if (!btn || (btn.getAttribute('aria-expanded') === 'true') === open) return;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Hide how Kelo-1 feels' : 'How Kelo-1 feels');
    }

window.addEventListener('DOMContentLoaded', () => {
  const needs = document.getElementById('hudNeedsBtn');
  needs?.addEventListener('click', () => hudSetNeedsOpen(needs.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest && !e.target.closest('.hud-needs-wrap')) hudSetNeedsOpen(false);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hudSetNeedsOpen(false); });

  const eyes = document.getElementById('eyeCamHud');
  if (eyes) {
    eyes.addEventListener('pointerenter', () => { hudView.eyesHover = true; hudEyesWake(); });
    eyes.addEventListener('pointerleave', () => { hudView.eyesHover = false; hudEyesWake(); });
    eyes.addEventListener('pointerdown', hudEyesWake);
    eyes.addEventListener('focusin', hudEyesWake);
    eyes.addEventListener('focusout', hudEyesWake);
  }

  hudTick();
  setInterval(hudTick, 250);
});
