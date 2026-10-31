// Kelo-bot-1 — js/shop.js
// The script for shop.html, Kelo-1's shop website. It stands alone (none of the game's scripts load here).
// It shows the things he put up for sale from two places:
//   - his save in this browser (the same storage key the game uses, see BRAIN_KEY in js/agent.js), so
//     the owner sees new listings straight away
//   - shop-data.json next to this page, which the owner downloads with "Export shop" in the game and
//     commits, so everyone else sees the shop too
// There is no payment here. "Contact to buy" goes to the email or https link the owner set in Settings.

const SHOP_BRAIN_KEY = 'kelo1_brain_v3';
const SHOP_CONTACT_STORAGE_KEY = 'kelo1_shop_contact';

function shopEscape(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

// Same rule as the game's Settings (js/shopkeeping.js): only an email, a mailto: link or an https:// link
function shopContactLink(value) {
      const v = String(value || '').trim();
      if (!v) return '';
      if (/^[^\s@:/?]+@[^\s@/?]+\.[a-z]{2,}$/i.test(v)) return 'mailto:' + v;
      if (/^mailto:[^\s@:/?]+@[^\s@/?]+\.[a-z]{2,}(\?[^\s]*)?$/i.test(v)) return v;
      if (/^https:\/\/\S+$/i.test(v)) {
        try { if (new URL(v).protocol === 'https:') return v; } catch (e) {}
      }
      return '';
    }

function readLocalShop() {
      try {
        const saved = JSON.parse(localStorage.getItem(SHOP_BRAIN_KEY) || 'null');
        return saved && saved.shop && typeof saved.shop === 'object' ? saved.shop : null;
      } catch (e) {
        return null;
      }
    }

async function readPublishedShop() {
      try {
        const res = await fetch('./shop-data.json', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data === 'object' ? data : null;
      } catch (e) {
        return null;
      }
    }

// Only well-formed listings get shown; pictures must be image data URLs
function cleanListing(l) {
      if (!l || typeof l !== 'object' || typeof l.name !== 'string' || !l.name.trim()) return null;
      const price = Number(l.price);
      return {
        id: String(l.id || l.name).slice(0, 60),
        name: l.name.trim().slice(0, 80),
        description: String(l.description || '').slice(0, 300),
        price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null,
        image: /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(String(l.image || '')) ? l.image : '',
        listedAt: l.listedAt && !Number.isNaN(Date.parse(l.listedAt)) ? new Date(l.listedAt) : null
      };
    }

function priceText(p) {
      if (p === null) return 'Ask for a price';
      try { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(p) + ' CAD'; } catch (e) { return `$${p.toFixed(2)} CAD`; }
    }

function buyHref(contact, listing) {
      if (!contact) return '';
      if (contact.startsWith('mailto:')) {
        const subject = encodeURIComponent(`Kelo-1's shop: ${listing.name}`);
        const body = encodeURIComponent(`Hi! I'd like to buy "${listing.name}" (${priceText(listing.price)}) from Kelo-1's shop.`);
        return `${contact}${contact.includes('?') ? '&' : '?'}subject=${subject}&body=${body}`;
      }
      return contact;
    }

function renderShop(listings, contact, updatedAt) {
      const grid = document.getElementById('shopGrid');
      const empty = document.getElementById('shopEmpty');
      const status = document.getElementById('orderStatus');
      status.innerHTML = contact
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">● Taking orders</span>'
        : '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">○ The shop isn\'t taking orders yet. Have a look around!</span>';
      empty.classList.toggle('hidden', listings.length > 0);
      grid.innerHTML = listings.map(l => {
        const href = buyHref(contact, l);
        const external = href.startsWith('https:');
        return `
        <article class="rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/50 overflow-hidden shadow-xl flex flex-col transition">
          <div class="aspect-square bg-gradient-to-b from-amber-100 to-orange-200 flex items-center justify-center">
            ${l.image ? `<img src="${shopEscape(l.image)}" alt="${shopEscape(l.name)}" class="w-full h-full object-cover" loading="lazy">` : '<span class="text-6xl" aria-hidden="true">🎁</span>'}
          </div>
          <div class="p-4 space-y-2 flex-1 flex flex-col">
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-sm font-bold text-white leading-snug">${shopEscape(l.name)}</h2>
              <span class="text-sm font-mono font-bold text-emerald-300 shrink-0">${shopEscape(priceText(l.price))}</span>
            </div>
            ${l.description ? `<p class="font-serif italic text-slate-300 text-sm leading-relaxed flex-1">"${shopEscape(l.description)}"<span class="not-italic text-slate-500 text-xs"> — Kelo-1</span></p>` : '<div class="flex-1"></div>'}
            ${l.listedAt ? `<div class="text-[10px] font-mono text-slate-500">Listed ${shopEscape(l.listedAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }))}</div>` : ''}
            ${href
              ? `<a href="${shopEscape(href)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block text-center px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-sm transition">✉️ Contact to buy</a>`
              : '<div class="text-center px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-400 text-xs font-semibold">Not taking orders yet</div>'}
          </div>
        </article>`;
      }).join('');
      const updated = document.getElementById('shopUpdated');
      updated.textContent = updatedAt ? `Shop last updated ${updatedAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}` : '';
    }

async function loadShop() {
      const local = readLocalShop();
      const published = await readPublishedShop();
      const soldHere = new Set(((local && Array.isArray(local.sold)) ? local.sold : []).map(s => s && s.id).filter(Boolean));
      const byId = new Map();
      // Published listings first, then this browser's newer save on top (minus anything sold since)
      ((published && Array.isArray(published.listings)) ? published.listings : []).map(cleanListing).filter(Boolean)
        .forEach(l => { if (!soldHere.has(l.id)) byId.set(l.id, l); });
      ((local && Array.isArray(local.listings)) ? local.listings : []).map(cleanListing).filter(Boolean)
        .forEach(l => byId.set(l.id, l));
      const listings = [...byId.values()].sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));
      let contact = '';
      try { contact = shopContactLink(localStorage.getItem(SHOP_CONTACT_STORAGE_KEY)); } catch (e) {}
      if (!contact && published) contact = shopContactLink(published.contact);
      const times = [local && local.updatedAt, published && Date.parse(published.updatedAt)].filter(t => Number.isFinite(t));
      renderShop(listings, contact, times.length ? new Date(Math.max(...times)) : null);
    }

window.addEventListener('DOMContentLoaded', loadShop);
