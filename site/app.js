// Leafwatch UK — dependency-free single-page app. Data: ./data/products.json + ./data/events.json
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TODAY = () => new Date(window.__TODAY__ || Date.now());
const store = {
  get(k, d) { try { const v = localStorage.getItem('lw:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lw:' + k, JSON.stringify(v)); } catch {} }
};
const state = {
  products: [], events: [], meta: {}, news: [], cups: { results: [] }, laws: { countries: [] },
  pharmacy: store.get('pharmacy', 'Medicann'),
  newsTag: 'all', lawQ: '',
  watch: new Set(store.get('watch', [])),
  follow: store.get('follow', []),               // saved searches: aroma / producer / "non-irradiated"
  compare: store.get('compare', []),
  rules: { new_listing: true, restock: true, price_change: true, announced: true, rumour: false, discontinued: true, news_uk_launch: true, scope: 'watch+follow', ...store.get('rules', {}) },
  seen: store.get('seen', null),
  filters: { q: '', form: '', thcMin: 0, thcMax: 40, cbdMax: 30, priceMax: 20, strain: '', producer: [], terpene: [], aroma: [], irr: '', pharmacy: [], stock: '', conf: '', sort: 'new' }
};

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  browse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 4v16M17 4v16M3 8h8M13 16h8"/></svg>',
  watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15z"/><path d="M10 21h4"/></svg>'
};
const NAV = [['/', 'New', 'home'], ['/browse', 'Browse', 'browse'], ['/stock', 'Stock', 'stock'], ['/compare', 'Compare', 'compare'], ['/news', 'News', 'more'], ['/cups', 'Cups', 'more'], ['/laws', 'Laws', 'more'], ['/watch', 'Watchlist', 'watch'], ['/alerts', 'Alerts', 'alerts']];
// phone tab bar: 5 slots; everything else lives under More
const TABS = [['/', 'New', 'home'], ['/browse', 'Browse', 'browse'], ['/watch', 'Watchlist', 'watch'], ['/alerts', 'Alerts', 'alerts'], ['/more', 'More', 'more']];
const MORE_PATHS = ['/more', '/stock', '/compare', '/news', '/cups', '/laws', '/legend'];
const EV_LABEL = { new_listing: 'New listing', restock: 'Restocked', price_change: 'Price change', announced: 'Announced', rumour: 'Rumour', discontinued: 'Discontinued' };
const EV_CLASS = { new_listing: 't-new', restock: 't-restock', price_change: 't-price', announced: 't-announced', rumour: 't-rumour', discontinued: 't-disc' };

// ---------- helpers
const byId = id => state.products.find(p => p.id === id);
const daysAgo = d => d ? Math.floor((TODAY() - new Date(d)) / 864e5) : null;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not confirmed';
const rel = d => { const n = daysAgo(d); return n == null ? '' : n <= 0 ? 'today' : n === 1 ? 'yesterday' : n < 30 ? n + 'd ago' : fmtDate(d); };
const money = n => n == null ? '—' : '£' + Number(n).toFixed(2);
const pct = n => n == null ? '—' : n + '%';
const uniq = (arr) => [...new Set(arr)].filter(Boolean).sort();
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); };
const save = () => { store.set('watch', [...state.watch]); store.set('follow', state.follow); store.set('compare', state.compare); store.set('rules', state.rules); };
const isSample = p => p.record === 'sample';
const atMyPharmacy = p => !!state.pharmacy && (p.pharmacies || []).some(x => x.toLowerCase().includes(state.pharmacy.toLowerCase()));
// cup match: a winning strain name appears as a whole phrase in the product's own name (not its parents);
// very short one-word names ("Black") are skipped to avoid false matches
const cupMatches = p => { const hay = ` ${p.name || ''} `.toLowerCase(); return (state.cups.results || []).filter(c => (c.strain.includes(' ') || c.strain.length >= 6) && new RegExp(`[^a-z0-9]${c.strain.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z0-9]`).test(hay)); };
const cupTag = p => cupMatches(p).length ? '<span class="tag t-cup" title="Shares a name with a cup-winning strain">🏆 Cup genetics</span>' : '';
const pharmTag = p => atMyPharmacy(p) ? `<span class="tag t-mine">At ${esc(state.pharmacy)}</span>` : '';
const confTag = p => p.status === 'discontinued' ? '<span class="tag t-disc">Discontinued</span>' :
  p.confidence === 'rumour' ? '<span class="tag t-rumour">Rumour · unconfirmed</span>' :
  p.confidence === 'announced' ? '<span class="tag t-announced">Announced</span>' : '<span class="tag t-confirmed">✓ Confirmed</span>';
const stockTag = p => ({ in_stock: '<span class="tag t-restock">In stock</span>', low: '<span class="tag t-low">Low stock</span>', out: '<span class="tag t-out">Out of stock</span>', discontinued: '<span class="tag t-disc">Discontinued</span>', unknown: '<span class="tag t-neutral">Stock unknown</span>' }[p.stock]);
const irrTag = p => p.irradiated === 'no' ? '<span class="tag t-confirmed">Non-irradiated</span>' : p.irradiated === 'yes' ? '<span class="tag t-neutral">Irradiated</span>' : '<span class="tag t-neutral">Irradiation unknown</span>';
const aromaTags = p => (p.aroma || []).map(a => `<span class="tag t-${a}">${a === 'citrus' ? '🍋 Citrus' : '⛽ Diesel'}</span>`).join('');
const sampleTag = p => isSample(p) ? '<span class="tag t-sample" title="Illustrative record, not real product data">Sample</span>' : '';
const eventsFor = id => state.events.filter(e => e.productId === id);
const isFollowed = p => state.watch.has(p.id) || state.follow.some(f => matchFollow(f, p));
function matchFollow(f, p) {
  if (f.kind === 'aroma') return (p.aroma || []).includes(f.value);
  if (f.kind === 'producer') return p.producer === f.value;
  if (f.kind === 'irr') return p.irradiated === 'no';
  if (f.kind === 'strain') return (p.genetics || p.name || '').toLowerCase().includes(f.value.toLowerCase());
  return false;
}
const followLabel = f => f.kind === 'aroma' ? (f.value === 'citrus' ? '🍋 Citrus profiles' : '⛽ Diesel profiles') : f.kind === 'irr' ? 'Non-irradiated flower' : f.kind === 'producer' ? f.value : 'Strain: ' + f.value;

function card(p, extra = '') {
  const price = p.pricePerGram != null ? `${money(p.pricePerGram)}<small>/g</small>` : p.pricePerMl != null ? `${money(p.pricePerMl)}<small>/ml</small>` : '—';
  return `<article class="card">
    <div class="head"><div><h3><a href="#/p/${p.id}">${esc(p.name)}</a></h3><div class="muted">${esc(p.producer)}${p.origin ? ' · ' + esc(p.origin) : ''}</div></div>
    <button class="heart" data-watch="${p.id}" aria-pressed="${state.watch.has(p.id)}" aria-label="Watch ${esc(p.name)}">${state.watch.has(p.id) ? '♥' : '♡'}</button></div>
    <div class="row">${confTag(p)}${p.status !== 'discontinued' && p.confidence !== 'rumour' ? stockTag(p) : ''}${sampleTag(p)}</div>
    <div class="metrics"><div class="metric"><b>${pct(p.thc)}</b><span>THC</span></div><div class="metric"><b>${pct(p.cbd)}</b><span>CBD</span></div><div class="metric"><b>${price}</b><span>Price</span></div></div>
    <div class="row">${p.form === 'flower' ? irrTag(p) : ''}${aromaTags(p)}${cupTag(p)}${pharmTag(p)}</div>${extra}</article>`;
}
const grid = (list, fn = card) => list.length ? `<div class="grid">${list.map(p => fn(p)).join('')}</div>` : '<div class="empty">Nothing here yet.</div>';

// ---------- views
function viewHome() {
  const P = state.products;
  const upcoming = P.filter(p => p.status === 'upcoming').sort((a, b) => (a.releaseDate || '9') < (b.releaseDate || '9') ? -1 : 1);
  const confirmedUp = upcoming.filter(p => p.confidence === 'announced');
  const rumours = upcoming.filter(p => p.confidence === 'rumour');
  const recentNew = state.events.filter(e => e.type === 'new_listing' && daysAgo(e.ts) <= 21).map(e => byId(e.productId)).filter(Boolean);
  const restocks = state.events.filter(e => e.type === 'restock' && daysAgo(e.ts) <= 14).map(e => byId(e.productId)).filter(Boolean);
  const prices = state.events.filter(e => e.type === 'price_change' && daysAgo(e.ts) <= 21);
  const spot = {
    irr: P.filter(p => p.irradiated === 'no' && p.status !== 'discontinued').sort((a, b) => (b.record === 'sample') - (a.record === 'sample') || (b.firstSeen || '').localeCompare(a.firstSeen || '')),
    citrus: P.filter(p => (p.aroma || []).includes('citrus') && p.status !== 'discontinued'),
    diesel: P.filter(p => (p.aroma || []).includes('diesel') && p.status !== 'discontinued')
  };
  const sp = state.homeSpot || 'irr';
  return `
  <section class="hero"><h1>What's new in UK medical cannabis</h1>
   <p>New listings, restocks and launches, with every item labelled confirmed, announced or rumour.</p>
   <div class="stats"><div class="stat"><b>${recentNew.length}</b><span>new listings (21d)</span></div><div class="stat"><b>${restocks.length}</b><span>restocks (14d)</span></div><div class="stat"><b>${upcoming.length}</b><span>upcoming / rumoured</span></div></div></section>

  <div class="sec"><h2>Spotlight</h2></div>
  <div class="chips" role="group" aria-label="Spotlight">
   ${[['irr', 'Non-irradiated'], ['citrus', '🍋 Citrus'], ['diesel', '⛽ Diesel']].map(([k, l]) => `<button class="chip" data-spot="${k}" aria-pressed="${sp === k}">${l} <span class="muted" style="color:inherit;opacity:.75">${spot[k].length}</span></button>`).join('')}
  </div>
  ${grid(spot[sp].slice(0, 6))}
  <p><a href="#/browse?${sp === 'irr' ? 'irr=no' : 'aroma=' + sp}">See all →</a></p>

  <div class="sec"><h2>Upcoming launches</h2><a href="#/legend">What do the labels mean?</a></div>
  <p class="sub">Announced = a producer, importer or pharmacy has said so. Dates can move.</p>
  ${grid(confirmedUp, p => card(p, `<div class="muted">📅 Expected ${esc(fmtDate(p.releaseDate))}</div>`))}
  <div class="callout"><strong>Rumours</strong> — unverified. Treat as a lead, never as a release.</div>
  ${grid(rumours, p => card(p, `<div class="muted">First heard ${rel(p.firstSeen)}. ${esc(p.notes || '')}</div>`))}

  <div class="sec"><h2>Newly listed</h2><a href="#/alerts">Activity feed</a></div>
  ${grid(recentNew, p => card(p, `<div class="muted">Listed ${rel(p.firstSeen)}</div>`))}

  <div class="sec"><h2>Restocks</h2><a href="#/stock">Stock tracker</a></div>
  ${grid(restocks, p => card(p, `<div class="muted">Restocked ${rel(state.events.find(e => e.type === 'restock' && e.productId === p.id).ts)}</div>`))}

  ${state.news.some(n => (n.tags || []).includes('uk')) ? `<div class="sec"><h2>Latest UK news</h2><a href="#/news">All news</a></div><div class="timeline">${state.news.filter(n => (n.tags || []).includes('uk')).slice(0, 4).map(n => `<a class="ev" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><time>${rel(n.published)}</time><div class="b"><strong>${esc(n.title)}</strong><div class="muted">${esc(n.source)}</div></div></a>`).join('')}</div>` : ''}
  ${prices.length ? `<div class="sec"><h2>Price changes</h2></div><div class="timeline">${prices.map(evRow).join('')}</div>` : ''}
  <div class="sec"><h2>Recently added to the tracker</h2></div>
  <div class="timeline">${P.filter(p => p.record === 'announcement').map(p => `<a class="ev" href="#/p/${p.id}"><time>${rel(p.firstSeen)}</time><div class="b"><strong>${esc(p.name)}</strong><div class="muted">${esc(p.producer)} · from public announcement</div></div></a>`).join('')}</div>`;
}
function evRow(e, unread) {
  const p = byId(e.productId); if (!p) return '';
  const d = e.type === 'price_change' ? `${money(e.detail.from)} → ${money(e.detail.to)} /g` : '';
  return `<a class="ev${unread ? ' unread' : ''}" href="#/p/${p.id}"><time>${rel(e.ts)}</time><div class="b"><strong>${esc(p.name)}</strong> <span class="tag ${EV_CLASS[e.type]}">${EV_LABEL[e.type]}</span><div class="muted">${esc(p.producer)} ${d ? '· ' + d : ''}</div></div></a>`;
}

function applyFilters(list) {
  const f = state.filters, q = f.q.trim().toLowerCase();
  let r = list.filter(p => {
    if (q && !(`${p.name} ${p.producer} ${p.genetics || ''} ${p.origin || ''}`.toLowerCase().includes(q))) return false;
    if (f.form && p.form !== f.form) return false;
    if (p.thc != null && (p.thc < f.thcMin || p.thc > f.thcMax)) return false;
    if (p.thc == null && (f.thcMin > 0 || f.thcMax < 40)) return false;
    if (p.cbd != null && p.cbd > f.cbdMax) return false;
    if (p.pricePerGram != null && p.pricePerGram > f.priceMax) return false;
    if (p.pricePerGram == null && f.priceMax < 20) return false;
    if (f.strain && !(p.genetics || '').toLowerCase().includes(f.strain.toLowerCase())) return false;
    if (f.producer.length && !f.producer.includes(p.producer)) return false;
    if (f.terpene.length && !f.terpene.every(t => (p.terpenes || []).some(x => x.name === t))) return false;
    if (f.aroma.length && !f.aroma.every(a => (p.aroma || []).includes(a))) return false;
    if (f.irr && p.irradiated !== f.irr) return false;
    if (f.pharmacy.length && !f.pharmacy.some(x => (p.pharmacies || []).includes(x))) return false;
    if (f.stock && p.stock !== f.stock) return false;
    if (f.mine && !atMyPharmacy(p)) return false;
    if (f.cup && !cupMatches(p).length) return false;
    if (f.conf && (f.conf === 'released' ? !(p.status === 'released' && p.confidence === 'confirmed') : p.confidence !== f.conf)) return false;
    return true;
  });
  const s = f.sort;
  r.sort((a, b) => s === 'thc' ? (b.thc ?? -1) - (a.thc ?? -1) : s === 'price' ? (a.pricePerGram ?? 999) - (b.pricePerGram ?? 999) :
    s === 'ppg' ? ((a.pricePerGram ?? 999) / Math.max(a.thc || 1, 1)) - ((b.pricePerGram ?? 999) / Math.max(b.thc || 1, 1)) :
    (b.firstSeen || '').localeCompare(a.firstSeen || ''));
  return r;
}
const activeCount = () => { const f = state.filters; let n = 0; if (f.form) n++; if (f.thcMin > 0 || f.thcMax < 40) n++; if (f.cbdMax < 30) n++; if (f.priceMax < 20) n++; if (f.strain) n++; n += f.producer.length + f.terpene.length + f.aroma.length + f.pharmacy.length; if (f.irr) n++; if (f.mine) n++; if (f.cup) n++; if (f.stock) n++; if (f.conf) n++; return n; };
function viewBrowse() {
  const list = applyFilters(state.products), n = activeCount();
  return `<div class="toolbar"><input type="search" id="q" placeholder="Search strain, producer, genetics" value="${esc(state.filters.q)}" aria-label="Search"><button class="btn" id="open-filters">Filters${n ? ` (${n})` : ''}</button></div>
  <div class="chips">
   <button class="chip" data-quick="irr" aria-pressed="${state.filters.irr === 'no'}">Non-irradiated</button>
   <button class="chip" data-quick="citrus" aria-pressed="${state.filters.aroma.includes('citrus')}">🍋 Citrus</button>
   <button class="chip" data-quick="diesel" aria-pressed="${state.filters.aroma.includes('diesel')}">⛽ Diesel</button>
   <button class="chip" data-quick="stock" aria-pressed="${state.filters.stock === 'in_stock'}">In stock</button>
   ${state.pharmacy ? `<button class="chip" data-quick="mine" aria-pressed="${!!state.filters.mine}">At ${esc(state.pharmacy)}</button>` : ''}
   <button class="chip" data-quick="cup" aria-pressed="${!!state.filters.cup}">🏆 Cup genetics</button>
   ${n ? '<button class="chip" data-quick="clear">Clear all</button>' : ''}</div>
  <div class="row between"><span class="muted">${list.length} of ${state.products.length} products</span>
   <select id="sort" style="width:auto" aria-label="Sort">${[['new', 'Newest'], ['thc', 'Highest THC'], ['price', 'Lowest £/g'], ['ppg', 'Best £ per THC %']].map(([v, l]) => `<option value="${v}" ${state.filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div style="height:10px"></div>
  ${grid(list)}${n && !list.length ? '<div class="empty">No matches. Try widening the filters.</div>' : ''}
  ${n ? `<p><button class="btn" id="follow-this">♡ Follow this search</button></p>` : ''}`;
}
function openFilters() {
  const P = state.products, f = state.filters;
  const producers = uniq(P.map(p => p.producer)), terps = uniq(P.flatMap(p => (p.terpenes || []).map(t => t.name))), pharm = uniq(P.flatMap(p => p.pharmacies || []));
  const multi = (name, arr, sel) => `<div class="chips" style="flex-wrap:wrap;overflow:visible;margin:0;padding:0">${arr.map(v => `<button class="chip" data-m="${name}" data-v="${esc(v)}" aria-pressed="${sel.includes(v)}">${esc(v)}</button>`).join('')}</div>`;
  const seg = (name, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-s="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  openSheet(`<div class="row between"><h2>Filters</h2><button class="btn" data-close>Done</button></div>
   <div class="field"><span class="lbl">Type</span>${seg('form', [['', 'All'], ['flower', 'Flower'], ['oil', 'Oil'], ['vape', 'Vape']], f.form)}</div>
   <div class="field"><span class="lbl">Irradiation</span>${seg('irr', [['', 'Any'], ['no', 'Non-irradiated'], ['yes', 'Irradiated']], f.irr)}</div>
   <div class="field"><span class="lbl">Status</span>${seg('conf', [['', 'All'], ['released', 'Confirmed'], ['announced', 'Announced'], ['rumour', 'Rumours']], f.conf)}</div>
   <div class="field"><span class="lbl">Stock</span>${seg('stock', [['', 'Any'], ['in_stock', 'In'], ['low', 'Low'], ['out', 'Out']], f.stock)}</div>
   <div class="field"><label>THC ${f.thcMin}–${f.thcMax}%</label><div class="two"><input type="range" min="0" max="40" value="${f.thcMin}" data-r="thcMin" aria-label="Minimum THC"><input type="range" min="0" max="40" value="${f.thcMax}" data-r="thcMax" aria-label="Maximum THC"></div></div>
   <div class="field"><label>CBD up to ${f.cbdMax}%</label><input type="range" min="0" max="30" value="${f.cbdMax}" data-r="cbdMax"></div>
   <div class="field"><label>Price up to ${f.priceMax >= 20 ? 'any' : '£' + f.priceMax + '/g'}</label><input type="range" min="3" max="20" step="0.5" value="${f.priceMax}" data-r="priceMax"></div>
   <div class="field"><span class="lbl">Aroma family</span>${multi('aroma', ['citrus', 'diesel'], f.aroma)}</div>
   <div class="field"><span class="lbl">Terpenes (must contain)</span>${multi('terpene', terps, f.terpene)}</div>
   <div class="field"><label for="strain">Strain / genetics contains</label><input id="strain" value="${esc(f.strain)}" placeholder="e.g. Haze"></div>
   <div class="field"><span class="lbl">Producer</span>${multi('producer', producers, f.producer)}</div>
   <div class="field"><span class="lbl">Pharmacy</span>${multi('pharmacy', pharm, f.pharmacy)}</div>
   <div class="row"><button class="btn" id="reset-f">Reset</button><button class="btn primary" data-close style="flex:1">Show results</button></div>`);
}
function openSheet(html) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-bg" data-bg><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('#sheet-root').innerHTML = ''; document.body.style.overflow = ''; render(); }

function viewStock() {
  const P = state.products.filter(p => p.confidence !== 'rumour' && p.status !== 'upcoming');
  const groups = [['restocked', 'Recently restocked', P.filter(p => p.lastRestock && daysAgo(p.lastRestock) <= 14)], ['in_stock', 'In stock', P.filter(p => p.stock === 'in_stock')], ['low', 'Low stock', P.filter(p => p.stock === 'low')], ['out', 'Out of stock', P.filter(p => p.stock === 'out')], ['discontinued', 'Discontinued', P.filter(p => p.stock === 'discontinued')], ['unknown', 'Stock not yet tracked', P.filter(p => p.stock === 'unknown')]];
  const cur = state.stockTab || 'restocked';
  const g = groups.find(x => x[0] === cur);
  return `<h1>Stock tracker</h1><p class="sub">Availability as last seen at listed pharmacies. Stock changes fast — confirm with your clinic or pharmacy.</p>
   <div class="chips">${groups.map(([k, l, a]) => `<button class="chip" data-stab="${k}" aria-pressed="${cur === k}">${l} <span style="opacity:.7">${a.length}</span></button>`).join('')}</div>
   ${grid(g[2], p => card(p, `<div class="muted">${cur === 'restocked' ? 'Restocked ' + rel(p.lastRestock) : cur === 'discontinued' ? 'Discontinued ' + fmtDate(p.discontinuedOn) : 'Last checked ' + rel(p.lastVerified)}${p.pharmacies?.length ? ' · ' + esc(p.pharmacies.join(', ')) : ''}</div>`))}`;
}

function viewCompare() {
  const items = state.compare.map(byId).filter(Boolean);
  const picker = `<div class="field"><label for="cmp-add">Add a product (up to 4)</label><select id="cmp-add"><option value="">Choose…</option>${state.products.filter(p => !state.compare.includes(p.id)).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`;
  if (items.length < 1) return `<h1>Compare</h1><p class="sub">Side-by-side THC, price per gram, genetics and terpenes.</p>${picker}<div class="empty">Pick two to four products, or tap “Compare” on any product page.</div>`;
  const best = (fn, dir) => { const v = items.map(fn).filter(x => x != null); return v.length > 1 ? (dir === 'max' ? Math.max(...v) : Math.min(...v)) : null; };
  const bThc = best(p => p.thc, 'max'), bPrice = best(p => p.pricePerGram, 'min'), bPpt = best(p => p.pricePerGram && p.thc ? p.pricePerGram / p.thc : null, 'min');
  const allT = uniq(items.flatMap(p => (p.terpenes || []).map(t => t.name))), maxT = Math.max(1.5, ...items.flatMap(p => (p.terpenes || []).map(t => t.pct)));
  const cell = (p, fn) => `<td>${fn(p)}</td>`;
  const rows = [
    ['', p => `<a href="#/p/${p.id}"><strong>${esc(p.name)}</strong></a><div class="muted">${esc(p.producer)}</div><button class="btn" style="min-height:36px;padding:4px 10px;margin-top:6px" data-cmp-rm="${p.id}">Remove</button>`],
    ['Status', p => confTag(p)], ['Stock', p => stockTag(p)],
    ['THC', p => `<span class="${p.thc != null && p.thc === bThc ? 'best' : ''}">${pct(p.thc)}</span>`], ['CBD', p => pct(p.cbd)],
    ['Price / g', p => `<span class="${p.pricePerGram != null && p.pricePerGram === bPrice ? 'best' : ''}">${money(p.pricePerGram)}</span>`],
    ['£ per THC %', p => { const v = p.pricePerGram && p.thc ? p.pricePerGram / p.thc : null; return `<span class="${v != null && v === bPpt ? 'best' : ''}">${v ? '£' + v.toFixed(2) : '—'}</span>`; }],
    ['Genetics', p => esc(p.genetics || 'Not stated')], ['Irradiation', p => irrTag(p)], ['Aroma', p => aromaTags(p) || '—'], ['Origin', p => esc(p.origin || '—')],
    ...allT.map(t => [t, p => { const x = (p.terpenes || []).find(y => y.name === t); return x ? `${x.pct}%<div class="bar"><i style="width:${Math.min(100, x.pct / maxT * 100)}%"></i></div>` : '<span class="muted">—</span>'; }]),
    ['Last verified', p => fmtDate(p.lastVerified)]
  ];
  return `<h1>Compare</h1><p class="sub">Green marks the best value in each row. “£ per THC %” is a rough value guide, not a quality score.</p>${items.length < 4 ? picker : ''}
   <div class="cmp"><table><tbody>${rows.map(([l, fn]) => `<tr><th scope="row">${l}</th>${items.map(p => cell(p, fn)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function viewWatch() {
  const items = [...state.watch].map(byId).filter(Boolean);
  const matched = state.products.filter(p => !state.watch.has(p.id) && state.follow.some(f => matchFollow(f, p)));
  return `<h1>Watchlist</h1><p class="sub">Saved on this device only. No account needed.</p>
  <div class="sec"><h2>Followed searches</h2></div>
  <div class="chips" style="flex-wrap:wrap;overflow:visible;margin:0;padding:0">
   ${state.follow.map((f, i) => `<button class="chip on" data-unfollow="${i}">${esc(followLabel(f))} ✕</button>`).join('') || '<span class="muted">None yet.</span>'}</div>
  <div class="chips" style="margin-top:8px"><span class="muted" style="align-self:center">Quick add:</span>
   <button class="chip" data-follow="irr">Non-irradiated</button><button class="chip" data-follow="citrus">🍋 Citrus</button><button class="chip" data-follow="diesel">⛽ Diesel</button></div>
  <div class="sec"><h2>Saved products (${items.length})</h2></div>
  ${items.length ? grid(items) : '<div class="empty">Tap ♡ on any product to save it here.</div>'}
  ${matched.length ? `<div class="sec"><h2>Matching your followed searches</h2></div>${grid(matched)}` : ''}`;
}

function relevantEvents() {
  const r = state.rules;
  return state.events.filter(e => {
    if (!r[e.type]) return false;
    const p = byId(e.productId); if (!p) return false;
    return r.scope === 'all' || isFollowed(p);
  }).sort((a, b) => b.ts.localeCompare(a.ts));
}
const launchNews = () => state.rules.news_uk_launch ? state.news.filter(n => (n.tags || []).includes('uk') && (n.tags || []).includes('launch')) : [];
const unreadCount = () => { const s = state.seen; return relevantEvents().filter(e => !s || e.ts > s).length + launchNews().filter(n => !s || n.firstSeen > s).length; };
function viewAlerts() {
  const r = state.rules, evs = relevantEvents(), seen = state.seen;
  const sw = (k, l, d) => `<label class="switch"><span><strong>${l}</strong><div class="muted">${d}</div></span><input type="checkbox" role="switch" data-rule="${k}" ${r[k] ? 'checked' : ''}></label>`;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<h1>Alerts</h1><p class="sub">Choose what matters. Alerts are matched against your watchlist and followed searches.</p>
  <div class="panel">${sw('new_listing', 'New releases & listings', 'A product appears for the first time')}${sw('announced', 'Announced launches', 'Confirmed upcoming dates')}${sw('restock', 'Restocks', 'Back in stock')}${sw('price_change', 'Price changes', 'Per-gram price moves')}${sw('discontinued', 'Discontinued', 'Product withdrawn')}${sw('rumour', 'Rumours', 'Unconfirmed leads — noisy, off by default')}${sw('news_uk_launch', 'UK launch news', 'News stories mentioning UK launches')}
   <div class="field"><span class="lbl">Apply to</span><div class="seg"><button data-scope="watch+follow" aria-pressed="${r.scope !== 'all'}">Watchlist & follows</button><button data-scope="all" aria-pressed="${r.scope === 'all'}">Everything</button></div></div></div>
  <div class="panel"><h3>Phone notifications</h3>
   <p class="muted">Free option: install the <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a> app and subscribe to your topic. The daily data job publishes every event there.</p>
   <div class="field"><label for="ntfy">ntfy topic (set by the site owner)</label><input id="ntfy" value="${esc(state.meta.ntfyTopic || '')}" readonly placeholder="Not configured"></div>
   ${state.meta.ntfyTopic ? `<a class="btn primary" href="https://ntfy.sh/${encodeURIComponent(state.meta.ntfyTopic)}" target="_blank" rel="noopener">Open topic</a>` : ''}
   <p class="muted" style="margin-top:12px">In-browser: ${perm === 'unsupported' ? 'not supported here' : perm === 'granted' ? 'enabled' : perm === 'denied' ? 'blocked in browser settings' : 'off'}. On iPhone, add this site to your Home Screen first (Share → Add to Home Screen).</p>
   ${perm === 'default' ? '<button class="btn" id="ask-notif">Enable browser notifications</button>' : ''}</div>
  <div class="sec"><h2>Your feed</h2><button class="btn" id="mark-read">Mark all read</button></div>
  ${launchNews().length ? `<div class="timeline">${launchNews().slice(0, 15).map(n => `<a class="ev${!seen || n.firstSeen > seen ? ' unread' : ''}" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><time>${rel(n.published)}</time><div class="b"><strong>${esc(n.title)}</strong> <span class="tag t-new">UK launch news</span><div class="muted">${esc(n.source)}</div></div></a>`).join('')}</div>` : ''}
  <div class="timeline">${evs.map(e => evRow(e, !seen || e.ts > seen)).join('') || '<div class="empty">No matching activity. Follow something on the Watchlist, or switch “Apply to” to Everything.</div>'}</div>`;
}

function viewProduct(id) {
  const p = byId(id); if (!p) return `<a class="back" href="#/">← Back</a><div class="empty">Product not found.</div>`;
  const ev = eventsFor(id).sort((a, b) => b.ts.localeCompare(a.ts));
  const stale = daysAgo(p.lastVerified) > 14;
  const maxT = Math.max(1.5, ...(p.terpenes || []).map(t => t.pct));
  return `<a class="back" href="javascript:history.back()">← Back</a>
  <div class="head"><div><h1>${esc(p.name)}</h1><div class="muted">${esc(p.producer)}${p.importer ? ' · imported by ' + esc(p.importer) : ''}</div></div>
   <button class="heart" data-watch="${p.id}" aria-pressed="${state.watch.has(p.id)}" aria-label="Watch">${state.watch.has(p.id) ? '♥' : '♡'}</button></div>
  <div class="row" style="margin:10px 0">${confTag(p)}${p.confidence !== 'rumour' ? stockTag(p) : ''}${p.form === 'flower' ? irrTag(p) : ''}${aromaTags(p)}${sampleTag(p)}</div>
  ${p.confidence === 'rumour' ? '<div class="callout"><strong>Unconfirmed.</strong> This is a rumour with no producer, importer or pharmacy source. It may never launch.</div>' : ''}
  ${p.confidence === 'announced' ? `<div class="callout info"><strong>Announced, not yet on sale.</strong> Expected ${esc(fmtDate(p.releaseDate))}. Dates can change.</div>` : ''}
  ${isSample(p) ? '<div class="callout warn"><strong>Sample record.</strong> Fictional demo data to show how a full entry looks. It is replaced by real listings once the data updater is connected to sources.</div>' : ''}
  ${p.record === 'announcement' ? '<div class="callout ok"><strong>From a public announcement.</strong> Only details stated in the source are shown; unknown fields are left blank rather than guessed.</div>' : ''}
  <div class="metrics" style="margin:12px 0"><div class="metric"><b>${pct(p.thc)}</b><span>THC</span></div><div class="metric"><b>${pct(p.cbd)}</b><span>CBD</span></div><div class="metric"><b>${p.pricePerGram != null ? money(p.pricePerGram) + '/g' : p.pricePerMl != null ? money(p.pricePerMl) + '/ml' : '—'}</b><span>Price</span></div></div>
  <div class="panel"><dl class="kv">
   <dt>Type</dt><dd>${esc(p.form)}</dd><dt>Genetics</dt><dd>${esc(p.genetics || 'Not stated')}</dd><dt>Origin</dt><dd>${esc(p.origin || '—')}</dd>
   <dt>Irradiation</dt><dd>${p.irradiated === 'no' ? 'Non-irradiated' : p.irradiated === 'yes' ? 'Irradiated' : 'Unknown'}${p.irradiationNote ? `<div class="muted">${esc(p.irradiationNote)}</div>` : ''}</dd>
   <dt>Release</dt><dd>${esc(fmtDate(p.releaseDate))}</dd><dt>First tracked</dt><dd>${esc(fmtDate(p.firstSeen))}</dd>
   ${p.lastRestock ? `<dt>Last restock</dt><dd>${esc(fmtDate(p.lastRestock))}</dd>` : ''}${p.previousPricePerGram ? `<dt>Price change</dt><dd>${money(p.previousPricePerGram)} → ${money(p.pricePerGram)} on ${esc(fmtDate(p.priceChangedOn))}</dd>` : ''}
   <dt>Available at</dt><dd>${p.pharmacies?.length ? esc(p.pharmacies.join(', ')) : 'No pharmacy listings tracked yet'}</dd></dl></div>
  ${p.terpenes?.length ? `<div class="panel"><h3>Terpene profile</h3>${p.terpenes.map(t => `<div style="margin-top:8px"><div class="row between"><span>${esc(t.name)}</span><span>${t.pct}%</span></div><div class="bar"><i style="width:${Math.min(100, t.pct / maxT * 100)}%"></i></div></div>`).join('')}<p class="muted">Terpene levels vary by batch. Check the certificate of analysis for your batch.</p></div>` : '<div class="panel muted">No terpene data published yet.</div>'}
  ${p.notes ? `<div class="panel">${esc(p.notes)}</div>` : ''}
  ${cupMatches(p).length ? `<div class="panel"><h3>🏆 Cup-winning genetics</h3><p class="muted">A strain with this name has won a cup. Cup wins belong to a specific grower and batch, so this product is not the same plant.</p><ul>${cupMatches(p).map(c => `<li>${esc(c.strain)}: ${ordinal(c.place)}, ${esc(c.category)}, ${esc(c.cup)} ${esc(c.edition)} ${c.year} (${esc(c.entrant)})${c.source ? ` <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ''}</li>`).join('')}</ul></div>` : ''}
  <div class="panel"><h3>Sources & verification</h3>
   <p class="${stale ? 'muted' : ''}">Last verified <strong>${esc(fmtDate(p.lastVerified))}</strong> (${rel(p.lastVerified)})${stale ? ' — may be out of date' : ''}.</p>
   ${p.sources?.length ? `<ul>${p.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')}</ul>` : '<p class="muted">No public source linked — treat as unverified.</p>'}
   <p class="muted">Cross-check: <a href="https://medbud.wiki/" target="_blank" rel="noopener noreferrer">MedBud Wiki ↗</a>${state.pharmacy ? ` · ask ${esc(state.pharmacy)} about current stock` : ''}</p></div>
  ${ev.length ? `<div class="sec"><h2>History</h2></div><div class="timeline">${ev.map(e => evRow(e)).join('')}</div>` : ''}
  <div class="row" style="margin-top:16px"><button class="btn primary" data-cmp-add="${p.id}">Compare</button><a class="btn" href="#/browse">Browse more</a></div>
  <p class="muted">Information only — not medical advice. Prescribing decisions are for your clinician.</p>`;
}

function viewLegend() {
  return `<a class="back" href="javascript:history.back()">← Back</a><h1>How labels work</h1>
  <div class="panel legend"><div><span class="tag t-confirmed">✓ Confirmed</span> Listed or released, with a public source.</div>
  <div><span class="tag t-announced">Announced</span> A producer, importer or pharmacy has stated a launch. Not yet purchasable.</div>
  <div><span class="tag t-rumour">Rumour</span> Unverified chatter. Never counted as a release.</div>
  <div><span class="tag t-new">New listing</span> First time we saw it on a tracked source.</div>
  <div><span class="tag t-restock">Restocked</span> Returned to availability after being out.</div>
  <div><span class="tag t-sample">Sample</span> Fictional demo record.</div></div>
  <h2>Data and method</h2>
  <p><strong>Automatic sources</strong> (checked every 6 hours): Medicann articles, Cannabis Health News, Leafie, Cannabis Industry Council, Business of Cannabis, High Times, MJBizDaily, Cannabis Business Times and Newsweed. News only ever creates leads; products are confirmed from producer, importer or pharmacy sources.</p>
  <p><strong>Not scraped:</strong> MedBud Wiki and Reddit block automated access, and Instagram, X, TikTok and Facebook have no free public feed. Product pages link out to MedBud Wiki for cross-checking instead.</p>
  <p>Facts come from producer and importer announcements, pharmacy and clinic listings, and certificates of analysis. Anything we cannot source is left blank. Every product shows its source links and a last-verified date.</p>
  <p class="muted">Dataset generated ${esc(fmtDate(state.meta.generatedAt))}. Independent; not affiliated with any producer, clinic or pharmacy. Not medical advice. UK medical cannabis is available only on prescription from a specialist clinician.</p>`;
}

const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

function viewMore() {
  const item = (h, t, d) => `<a class="ev" href="#${h}"><div class="b"><strong>${t}</strong><div class="muted">${d}</div></div><span aria-hidden="true">›</span></a>`;
  return `<h1>More</h1>
  <div class="panel timeline" style="padding-top:0;padding-bottom:0">
   ${item('/stock', 'Stock tracker', 'In stock, low, restocked, discontinued')}
   ${item('/compare', 'Compare', `Side by side · ${state.compare.length} selected`)}
   ${item('/news', 'News', `${state.news.length} stories from UK and international cannabis news`)}
   ${item('/cups', 'Cannabis Cup winners', 'Award-winning strains, matched to UK products')}
   ${item('/laws', 'World laws', `Medical and adult-use status in ${state.laws.countries.length} countries`)}
   ${item('/legend', 'How the data works', 'Labels, sources and verification')}</div>
  <div class="panel"><h3>My pharmacy</h3><p class="muted">Highlights products listed at your pharmacy and adds an “At my pharmacy” filter. Saved on this device.</p>
   <div class="field"><label for="pharm">Pharmacy</label><input id="pharm" value="${esc(state.pharmacy)}" placeholder="e.g. Medicann" list="pharm-list"><datalist id="pharm-list">${uniq(state.products.flatMap(p => p.pharmacies || [])).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
   ${/medicann/i.test(state.pharmacy) ? '<p class="muted">Medicann shows its products to patients inside the Medicann app, not on its public website, so stock for Medicann can’t be tracked automatically yet. Medicann news is included in the News feed.</p>' : ''}</div>`;
}

const NEWS_TAGS = [['all', 'All'], ['uk', '🇬🇧 UK'], ['launch', 'Launches'], ['regulation', 'Laws'], ['cup', 'Cups'], ['medical', 'Medical']];
function viewNews() {
  const t = state.newsTag, list = state.news.filter(n => t === 'all' || (n.tags || []).includes(t)).slice(0, 120);
  return `<h1>News</h1><p class="sub">Headlines from cannabis news sites, refreshed every few hours. Tap through to read the full story on the publisher's site.</p>
  <div class="chips">${NEWS_TAGS.map(([k, l]) => `<button class="chip" data-ntag="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div>
  <div class="timeline">${list.map(n => `<a class="ev" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><time>${rel(n.published)}</time><div class="b"><strong>${esc(n.title)}</strong><div class="muted">${esc(n.source)}${(n.tags || []).includes('launch') && (n.tags || []).includes('uk') ? ' · <span class="tag t-new">UK launch?</span>' : ''}</div>${n.summary ? `<div class="muted" style="margin-top:4px">${esc(n.summary.slice(0, 160))}${n.summary.length > 160 ? '…' : ''}</div>` : ''}</div></a>`).join('') || '<div class="empty">No stories yet. They appear after the next automatic update.</div>'}</div>
  <p class="muted">News items are leads, not confirmed releases. A product only shows as Confirmed once it has a pharmacy or producer source.</p>`;
}

function viewCups() {
  const R = state.cups.results || [];
  const groups = {}; R.forEach(c => { (groups[`${c.cup} · ${c.edition} ${c.year}`] ||= []).push(c); });
  const keys = Object.keys(groups).sort((a, b) => groups[b][0].year - groups[a][0].year);
  const matched = state.products.filter(p => cupMatches(p).length);
  return `<h1>Cannabis Cup winners</h1><p class="sub">Flower results from major cups. 🏆 marks UK products that share a winning strain name.</p>
  ${matched.length ? `<div class="sec"><h2>In the UK tracker</h2></div>${grid(matched)}` : '<div class="callout info">No tracked UK product currently shares a name with a listed winner.</div>'}
  ${keys.map(k => `<div class="sec"><h2>${esc(k)}</h2></div><div class="panel" style="padding-top:4px;padding-bottom:4px">${groups[k].sort((a, b) => a.category.localeCompare(b.category) || a.place - b.place).map(c => `<div class="switch" style="min-height:0"><span><strong>${c.place === 1 ? '🥇' : c.place === 2 ? '🥈' : c.place === 3 ? '🥉' : ordinal(c.place)} ${esc(c.strain)}</strong><div class="muted">${esc(c.category)} · ${esc(c.entrant)}</div></span>${c.source ? `<a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer" class="muted">source ↗</a>` : ''}</div>`).join('')}</div>`).join('')}
  <p class="muted">${esc(state.cups.note || '')} Reviewed ${esc(fmtDate(state.cups.reviewed))}.</p>`;
}

const MED = { legal: ['Medical: legal', 't-confirmed'], limited: ['Medical: limited', 't-announced'], pilot: ['Medical: pilot', 't-low'], none: ['Medical: none', 't-out'] };
const ADULT = { legal: ['Adult use: legal', 't-confirmed'], decriminalised: ['Adult: decriminalised', 't-announced'], tolerated: ['Adult: tolerated', 't-low'], illegal: ['Adult use: illegal', 't-neutral'] };
function viewLaws() {
  const q = state.lawQ.trim().toLowerCase(), C = state.laws.countries || [];
  const list = C.filter(c => !q || `${c.country} ${c.region}`.toLowerCase().includes(q));
  const row = c => `<article class="card"><div class="head"><div><h3>${esc(c.country)}</h3><div class="muted">${esc(c.region)}${c.supplier ? ' · supplies UK patients' : ''}</div></div></div>
   <div class="row"><span class="tag ${MED[c.medical][1]}">${MED[c.medical][0]}</span><span class="tag ${ADULT[c.adult][1]}">${ADULT[c.adult][0]}</span></div>
   <p style="margin:0">${esc(c.summary)}</p>${c.source ? `<a class="muted" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>` : '<span class="muted">Check official government guidance.</span>'}</article>`;
  const focus = list.filter(c => c.focus), rest = list.filter(c => !c.focus);
  return `<h1>World laws</h1><p class="sub">Medical and adult-use status at a glance. Reviewed ${esc(fmtDate(state.laws.reviewed))}.</p>
  <div class="toolbar"><input type="search" id="lawq" placeholder="Search country or region" value="${esc(state.lawQ)}" aria-label="Search countries"></div>
  <div class="callout warn">${esc(state.laws.note || '')}</div>
  ${focus.length ? `<div class="sec"><h2>UK & Crown Dependencies</h2></div><div class="grid">${focus.map(row).join('')}</div>` : ''}
  ${rest.length ? `<div class="sec"><h2>Worldwide</h2></div><div class="grid">${rest.map(row).join('')}</div>` : ''}
  <p class="muted">Not legal advice. Law changes are also picked up in News under “Laws”.</p>`;
}

// ---------- router / render
function parse() {
  const h = location.hash.slice(1) || '/'; const [path, qs] = h.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}
function render() {
  const { path, params } = parse();
  let html;
  if (path.startsWith('/p/')) html = viewProduct(decodeURIComponent(path.slice(3)));
  else if (path === '/browse') {
    if (params.has('irr')) state.filters.irr = params.get('irr');
    if (params.has('aroma')) state.filters.aroma = [params.get('aroma')];
    if (params.has('irr') || params.has('aroma')) history.replaceState(null, '', '#/browse');
    html = viewBrowse();
  } else html = { '/': viewHome, '/stock': viewStock, '/compare': viewCompare, '/watch': viewWatch, '/alerts': viewAlerts, '/legend': viewLegend, '/more': viewMore, '/news': viewNews, '/cups': viewCups, '/laws': viewLaws }[path]?.() || viewHome();
  const keepScroll = render.last === path ? scrollY : 0;
  $('#app').innerHTML = html;
  if (render.last !== path) scrollTo(0, 0); else scrollTo(0, keepScroll);
  render.last = path;
  const cur = path === '/' ? '/' : '/' + path.split('/')[1];
  const link = ([h, l, i], tab) => `<a href="#${h}" ${cur === h ? 'aria-current="page"' : ''}>${tab ? ICON[i] : ''}<span>${l}</span>${h === '/alerts' && unreadCount() ? `<span class="badge-dot">${unreadCount()}</span>` : ''}</a>`;
  $('.tabbar').innerHTML = TABS.map(n => link(n, true)).join('').replace('href="#/more"', MORE_PATHS.includes(cur) && cur !== '/more' ? 'href="#/more" aria-current="page"' : 'href="#/more"');
  $('.side').innerHTML = NAV.map(n => link(n, false)).join('');
  document.title = path.startsWith('/p/') ? (byId(path.slice(3))?.name || 'Product') + ' · Leafwatch UK' : 'Leafwatch UK';
  const demo = state.products.some(isSample);
  const b = $('#demo-banner'); b.hidden = !demo; if (demo) b.innerHTML = 'Preview data: records marked <b>Sample</b> are fictional. <a href="#/legend">How data works</a>';
}

// ---------- events
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-bg]'); if (!t) return;
  const d = t.dataset;
  if (t.matches('[data-bg]') && e.target === t) return closeSheet();
  if ('close' in d) return closeSheet();
  if (d.watch) { const id = d.watch; state.watch.has(id) ? state.watch.delete(id) : (state.watch.add(id), toast('Added to watchlist')); save(); return render(); }
  if (d.spot) { state.homeSpot = d.spot; return render(); }
  if (d.ntag) { state.newsTag = d.ntag; return render(); }
  if (d.stab) { state.stockTab = d.stab; return render(); }
  if (d.quick) {
    const f = state.filters;
    if (d.quick === 'irr') f.irr = f.irr === 'no' ? '' : 'no';
    if (d.quick === 'citrus' || d.quick === 'diesel') f.aroma = f.aroma.includes(d.quick) ? f.aroma.filter(x => x !== d.quick) : [...f.aroma, d.quick];
    if (d.quick === 'stock') f.stock = f.stock === 'in_stock' ? '' : 'in_stock';
    if (d.quick === 'mine') f.mine = !f.mine;
    if (d.quick === 'cup') f.cup = !f.cup;
    if (d.quick === 'clear') Object.assign(state.filters, { mine: false, cup: false, q: '', form: '', thcMin: 0, thcMax: 40, cbdMax: 30, priceMax: 20, strain: '', producer: [], terpene: [], aroma: [], irr: '', pharmacy: [], stock: '', conf: '' });
    return render();
  }
  if (t.id === 'open-filters') return openFilters();
  if (t.id === 'reset-f') { Object.assign(state.filters, { form: '', thcMin: 0, thcMax: 40, cbdMax: 30, priceMax: 20, strain: '', producer: [], terpene: [], aroma: [], irr: '', pharmacy: [], stock: '', conf: '' }); return openFilters(); }
  if (d.m) { const a = state.filters[d.m], i = a.indexOf(d.v); i < 0 ? a.push(d.v) : a.splice(i, 1); const y = $('.sheet').scrollTop; openFilters(); $('.sheet').scrollTop = y; return; }
  if (d.s) { state.filters[d.s] = d.v; const y = $('.sheet').scrollTop; openFilters(); $('.sheet').scrollTop = y; return; }
  if (t.id === 'follow-this') {
    const f = state.filters; let n = 0;
    if (f.irr === 'no') { state.follow.push({ kind: 'irr' }); n++; }
    f.aroma.forEach(a => { state.follow.push({ kind: 'aroma', value: a }); n++; });
    f.producer.forEach(v => { state.follow.push({ kind: 'producer', value: v }); n++; });
    if (f.strain) { state.follow.push({ kind: 'strain', value: f.strain }); n++; }
    state.follow = state.follow.filter((x, i, a) => a.findIndex(y => JSON.stringify(y) === JSON.stringify(x)) === i);
    save(); return toast(n ? 'Following. See Watchlist' : 'Pick irradiation, aroma, producer or strain first');
  }
  if (d.follow) { state.follow.push(d.follow === 'irr' ? { kind: 'irr' } : { kind: 'aroma', value: d.follow }); state.follow = state.follow.filter((x, i, a) => a.findIndex(y => JSON.stringify(y) === JSON.stringify(x)) === i); save(); return render(); }
  if (d.unfollow) { state.follow.splice(+d.unfollow, 1); save(); return render(); }
  if (d.cmpAdd) { if (!state.compare.includes(d.cmpAdd)) { if (state.compare.length >= 4) return toast('Compare holds up to 4'); state.compare.push(d.cmpAdd); save(); } location.hash = '#/compare'; return; }
  if (d.cmpRm) { state.compare = state.compare.filter(x => x !== d.cmpRm); save(); return render(); }
  if (d.scope) { state.rules.scope = d.scope; save(); return render(); }
  if (t.id === 'mark-read') { state.seen = new Date(TODAY()).toISOString(); store.set('seen', state.seen); return render(); }
  if (t.id === 'ask-notif') { Notification.requestPermission().then(render); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { state.filters.q = t.value; const pos = t.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }
  if (t.dataset.r) { state.filters[t.dataset.r] = +t.value; if (state.filters.thcMin > state.filters.thcMax) state.filters[t.dataset.r === 'thcMin' ? 'thcMax' : 'thcMin'] = +t.value; }
  if (t.id === 'strain') state.filters.strain = t.value;
  if (t.id === 'lawq') { state.lawQ = t.value; const pos = t.selectionStart; render(); const q = $('#lawq'); q.focus(); q.setSelectionRange(pos, pos); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sort') { state.filters.sort = t.value; render(); }
  if (t.id === 'cmp-add' && t.value) { if (state.compare.length < 4) { state.compare.push(t.value); save(); } render(); }
  if (t.dataset.rule) { state.rules[t.dataset.rule] = t.checked; save(); }
  if (t.id === 'pharm') { state.pharmacy = t.value.trim(); store.set('pharmacy', state.pharmacy); render(); }
  if (t.dataset.r) { const y = $('.sheet').scrollTop; openFilters(); $('.sheet').scrollTop = y; }
});
addEventListener('hashchange', render);
addEventListener('keydown', e => { if (e.key === 'Escape' && $('.sheet')) closeSheet(); });
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', dark ? 'light' : 'dark');
});
{ const t = store.get('theme'); if (t) document.documentElement.dataset.theme = t; }

// ---------- boot
async function boot() {
  try {
    const inline = window.__DATA__;
    const opt = f => fetch(f).then(r => r.ok ? r.json() : null).catch(() => null);
    const [p, ev, news, cups, laws] = inline ? [inline.products, inline.events, inline.news, inline.cups, inline.laws] : await Promise.all([fetch('data/products.json').then(r => r.json()), fetch('data/events.json').then(r => r.json()), opt('data/news.json'), opt('data/cups.json'), opt('data/regulations.json')]);
    state.news = news?.items || []; if (cups) state.cups = cups; if (laws) state.laws = laws;
    state.products = p.products; state.meta = { generatedAt: p.generatedAt, ntfyTopic: p.ntfyTopic }; state.events = ev.events;
    if (!state.seen) { state.seen = new Date(TODAY() - 3 * 864e5).toISOString(); }
    render();
    if ('Notification' in window && Notification.permission === 'granted' && unreadCount()) { try { new Notification('Leafwatch UK', { body: unreadCount() + ' new update(s) match your alerts' }); } catch {} }
  } catch (err) {
    $('#app').innerHTML = `<div class="empty"><h2>Couldn't load data</h2><p>${esc(err.message)}</p></div>`;
  }
}
boot();
