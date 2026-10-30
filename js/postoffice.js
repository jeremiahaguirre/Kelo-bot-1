// Kelo-bot-1 — js/postoffice.js
// Loaded after agent.js. The Okanagan Post Office: everything people send Kelo-1 (messages,
// gifts, photos) waits here as mail until HE decides to walk over and pick it up. His own
// requests and questions go out from here as letters to the people watching.

const MAX_MAILBOX = 20;
const MAX_PARCELS_PER_TRIP = 3;
// Full-size photo data for the AI brain is kept in memory only (localStorage keeps thumbnails)
const parcelImages = new Map();

function postMail(parcel) {
      const entry = {
        id: 'mail-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        kind: parcel.kind,
        from: String(parcel.from || 'a visitor').slice(0, 40),
        name: String(parcel.name || '').slice(0, 80),
        category: parcel.category || '',
        emoji: parcel.emoji || (parcel.kind === 'photo' ? '📷' : parcel.kind === 'message' ? '✉️' : '📦'),
        note: String(parcel.note || '').slice(0, 500),
        thumbs: Array.isArray(parcel.thumbs) ? parcel.thumbs.slice(0, 4) : [],
        palette: parcel.palette || null,
        time: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      if (parcel.image) parcelImages.set(entry.id, parcel.image);
      if (state.mailbox.length >= MAX_MAILBOX) {
        showToast('📮 The post office is full. Kelo-1 needs to pick up his mail first.');
        return null;
      }
      state.mailbox.push(entry);
      // Let the AI brain (if any) design a model of the exact item while it waits at the post office
      if ((entry.kind === 'gift' || entry.kind === 'request') && typeof designItemModelWithAI === 'function') {
        (splitItemList(entry.name) || [entry.name]).forEach(n => designItemModelWithAI(n));
      }
      savePersistentBrainState();
      renderAllUI();
      showToast(`📮 Your ${entry.kind === 'message' ? 'letter' : entry.kind} is at the post office. Kelo-1 will pick it up when he chooses.`);
      return entry;
    }

function waitForArrival(timeoutMs = 15000) {
      return new Promise(resolve => {
        const started = Date.now();
        const check = () => {
          const d = Math.hypot(state.targetPos.x - state.botPos.x, state.targetPos.z - state.botPos.z);
          if (d < 0.6 || Date.now() - started > timeoutMs) resolve();
          else setTimeout(check, 250);
        };
        check();
      });
    }

async function openPhotoParcel(parcel) {
      const image = parcelImages.get(parcel.id) || null;
      parcelImages.delete(parcel.id);
      const caption = parcel.note;
      const time = parcel.time;
      const albumEntries = parcel.thumbs.map(thumb => ({ thumb, caption, from: parcel.from, palette: parcel.palette || [], time, reaction: '' }));
      state.photoAlbum.unshift(...albumEntries);
      const logEntry = { type: 'photo', name: parcel.name || 'A photo', category: 'photo', emoji: '📷', from: parcel.from, note: caption, time, reaction: '' };
      state.giftLog.unshift(logEntry);
      recordVisitorMemory(parcel.from, `Sent me ${logEntry.name.toLowerCase()}${caption ? ` ("${caption.slice(0, 60)}")` : ''}.`);
      const palette = parcel.palette && parcel.palette.length ? ` The main colors are ${parcel.palette.join(' and ')}.` : '';
      await decideNextAction(
        `At the post office you opened ${logEntry.name.toLowerCase()} from ${parcel.from}${caption ? ` captioned "${caption}"` : ''}.${palette} Look at it and decide for yourself what, if anything, it makes you want to do, build, ask, or think about.`,
        `Photo from ${parcel.from}`,
        { focus: caption || 'photo', image: image || (parcel.palette ? { primaryHex: parcel.palette[0], secondaryHex: parcel.palette[1] || parcel.palette[0] } : null) }
      );
      logEntry.reaction = state.speechBubble;
      albumEntries.forEach(e => { e.reaction = state.speechBubble; });
      if (typeof savePhotoAlbum === 'function') savePhotoAlbum();
    }

async function openParcel(parcel) {
      if (parcel.kind === 'message') {
        state.unopenedNotesQueue.push({ sender: parcel.from, text: parcel.note, timestamp: parcel.time });
        recordVisitorMemory(parcel.from, `Mailed me a letter: "${parcel.note.slice(0, 70)}"`);
        const logEntry = { type: 'letter', name: 'Letter', category: 'letter', emoji: '✉️', from: parcel.from, note: parcel.note.slice(0, 200), time: parcel.time, reaction: '' };
        state.giftLog.unshift(logEntry);
        await processNextUnopenedVisitorNote();
        logEntry.reaction = state.speechBubble;
      } else if (parcel.kind === 'photo') {
        await openPhotoParcel(parcel);
      } else {
        await receiveItem(parcel.name, parcel.category, parcel.from, parcel.note, { type: parcel.kind === 'request' ? 'request' : 'gift', emoji: parcel.emoji });
      }
    }

// Kelo-1 walks to the post office and opens a few parcels. He only does this when he chooses to.
async function pickUpMail(originLabel = 'Checking the Mail') {
      if (state.mailbox.length === 0 || state.isCollectingMail || state.isBusy || state.isBuilding || state.isPracticing) return false;
      state.isCollectingMail = true;
      try {
        directKeloToActivity('post_office', `Walked to the post office to see what people sent (${state.mailbox.length} waiting).`, originLabel);
        await waitForArrival();
        const parcels = state.mailbox.splice(0, MAX_PARCELS_PER_TRIP);
        state.lettersReceived = (state.lettersReceived || 0) + parcels.length;
        savePersistentBrainState();
        renderAllUI();
        showToast(`📬 Kelo-1 picked up ${parcels.length} item${parcels.length > 1 ? 's' : ''} from the post office`);
        for (const parcel of parcels) {
          // He picks up the actual item and carries it; food gets eaten, so he only holds it briefly
          if (typeof setCarriedObject === 'function') {
            const isFood = categorizeItem(parcel.name, parcel.category) === 'food';
            setCarriedObject(buildItemModel3D(parcel.kind === 'message' ? 'Letter' : parcel.name, { kind: parcel.kind, thumb: parcel.thumbs && parcel.thumbs[0] }),
              parcel.kind === 'message' || isFood ? 4000 : 30000);
          }
          await openParcel(parcel);
        }
        savePersistentBrainState();
        renderAllUI();
        return true;
      } finally {
        state.isCollectingMail = false;
      }
    }

// A visitor rings the post office bell. It's a nudge, not an order.
function ringPostOfficeBell() {
      if (state.mailbox.length === 0) {
        showToast('📭 No mail waiting for Kelo-1 right now.');
        return;
      }
      if (state.isBusy || state.isCollectingMail || Math.random() < 0.3) {
        state.speechBubble = `I heard the post office bell! I'll pick up the mail after I finish "${state.moodTitle}".`;
        renderAllUI();
        showToast('🔔 Kelo-1 heard the bell. He will go when he is ready.');
        return;
      }
      pickUpMail('Heard the Post Office Bell');
    }

// How likely he is to go check the mail on an autonomous tick
function mailPickupChance() {
      if (state.mailbox.length === 0) return 0;
      return Math.min(0.8, 0.3 + state.mailbox.length * 0.1);
    }
