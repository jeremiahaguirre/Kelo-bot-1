// On the pre-farm code: let him live a little, then dump his save
const fs = require('fs');
module.exports = async (page, h) => {
  await h.ev(() => { state.isCollectingMail = false; });
  await h.wait(60000);
  const data = await h.ev(() => { savePersistentBrainStateNow(); const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^kelo1/.test(k)) o[k] = localStorage.getItem(k); } return o; });
  fs.writeFileSync(process.env.SAVE_OUT, JSON.stringify(data));
  h.log('saved keys', Object.keys(data).length, 'farm in save:', /"farm"/.test(data.kelo1_brain_v4 || ''));
};
