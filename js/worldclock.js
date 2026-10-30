// Kelo-bot-1 — js/worldclock.js
// Loaded after agent.js. Kelo-1's own calendar: one of his days lasts 12 real hours (a full
// sunrise-to-night cycle), and his year has 365 of those days. The year starts on today's real
// date, so his seasons begin where Kelowna's are. Time keeps passing while the page is closed.

const WORLD_DAY_MS = 12 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

function realDayOfYear(date = new Date()) {
      const start = new Date(date.getFullYear(), 0, 0);
      return Math.floor((date - start) / 86400000) % DAYS_PER_YEAR;
    }

// Start his calendar the first time it is needed and keep it in his saved state
function ensureCalendar() {
      if (!state.calendar || !Number.isFinite(state.calendar.epoch)) {
        state.calendar = {
          epoch: Number.isFinite(state.life.bornAt) ? state.life.bornAt : Date.now(),
          startDayOfYear: realDayOfYear(),
          // He wakes at 7 in the morning on his first day
          startHour: 7
        };
      }
      return state.calendar;
    }

function worldNow(now = Date.now()) {
      const cal = ensureCalendar();
      const elapsed = Math.max(0, now - cal.epoch) + (cal.startHour / 24) * WORLD_DAY_MS;
      const dayIndex = Math.floor(elapsed / WORLD_DAY_MS);
      const hour = ((elapsed % WORLD_DAY_MS) / WORLD_DAY_MS) * 24;
      const dayOfYear = (cal.startDayOfYear + dayIndex) % DAYS_PER_YEAR;
      const year = 1 + Math.floor((cal.startDayOfYear + dayIndex) / DAYS_PER_YEAR);
      let season = 'Winter';
      if (dayOfYear >= 79 && dayOfYear < 171) season = 'Spring';
      else if (dayOfYear >= 171 && dayOfYear < 265) season = 'Summer';
      else if (dayOfYear >= 265 && dayOfYear < 355) season = 'Autumn';
      return { day: dayIndex + 1, dayOfYear: dayOfYear + 1, year, hour, season, isNight: hour < 5.5 || hour >= 21 };
    }

function clockLabel(hour) {
      const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
      const h12 = ((h + 11) % 12) + 1;
      return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    }

const SEASON_EMOJI = { Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄️' };

// --- Daylight: the sun moves across the sky over each 12-hour day ----------------------------
function lerpHex(a, b, t) {
      return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
    }

function applyTimeOfDay() {
      if (!scene || !sunLight || state.lightingMode === 'manual') return;
      const { hour } = worldNow();
      const [noon, golden, night] = AMBIANCE_PRESETS;
      // 0 = full night, 1 = full day; golden light around sunrise and sunset
      const dayAmount = Math.max(0, Math.min(1, hour < 12 ? (hour - 5) / 2.5 : (21 - hour) / 2.5));
      const goldenAmount = Math.max(0, 1 - Math.abs(hour < 12 ? hour - 6.5 : hour - 19.5) / 1.8);
      const mix = (key) => lerpHex(lerpHex(night[key], noon[key], dayAmount), golden[key], goldenAmount * dayAmount);
      scene.background = mix('bg');
      scene.fog.color.copy(mix('fog'));
      hemiLight.color.copy(mix('hemiSky'));
      hemiLight.groundColor.copy(mix('hemiGround'));
      sunLight.color.copy(mix('sunColor'));
      sunLight.intensity = night.sunInt + (noon.sunInt - night.sunInt) * dayAmount;
      hemiLight.intensity = 0.35 + 0.45 * dayAmount;
      if (skyDome) {
        skyDome.material.uniforms.topColor.value.copy(mix('skyTop'));
        skyDome.material.uniforms.horizonColor.value.copy(mix('skyHorizon'));
      }
      // The sun travels east to west; at night it becomes a dim moon overhead
      const arc = ((hour - 6) / 12) * Math.PI;
      sunLight.position.set(Math.cos(arc) * -60, Math.max(8, Math.sin(arc) * 60), 24);
    }

function renderClockUI() {
      const el = document.getElementById('worldClockText');
      if (!el) return;
      const w = worldNow();
      el.textContent = `📅 Day ${w.day} • ${SEASON_EMOJI[w.season]} ${w.season} (${w.dayOfYear}/365) • 🕒 ${clockLabel(w.hour)}${w.isNight ? ' 🌙' : ''}`;
    }

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    ensureCalendar();
    // He remembers how long he has been here: no "first day" greeting after day one
    const w = worldNow();
    if (w.day > 1 && /First Day Awake/.test(state.moodTitle)) {
      state.moodEmoji = w.isNight ? '🌙' : '🌅';
      state.moodTitle = w.isNight ? `Day ${w.day}: a quiet night` : `Day ${w.day}: another ${w.season.toLowerCase()} day`;
      state.speechBubble = `Day ${w.day} already. I remember everything so far.`;
      state.currentObsession = `"What should I do with day ${w.day}?"`;
    }
    applyTimeOfDay();
    renderClockUI();
    setInterval(() => { applyTimeOfDay(); renderClockUI(); }, 5000);
  }, 0);
});
