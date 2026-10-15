// Daily updater: fetch sources -> normalise -> diff against data/products.json -> write products/events -> optional ntfy push.
// Usage: node scripts/update.mjs [--dry] [--sources path] [--now ISO]
import { readFileSync, writeFileSync } from 'node:fs';
import { adapters } from './adapters.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const dry = process.argv.includes('--dry');
const now = arg('--now', new Date().toISOString());
const cfg = JSON.parse(readFileSync(arg('--sources', 'data/sources.json'), 'utf8'));
const db = JSON.parse(readFileSync('data/products.json', 'utf8'));
const evDb = JSON.parse(readFileSync('data/events.json', 'utf8'));
const byId = new Map(db.products.map(p => [p.id, p]));
const newEvents = [];
const emit = (type, p, detail = {}) => newEvents.push({ id: `${now.slice(0, 10)}-${type}-${p.id}`, ts: now, type, productId: p.id, detail });
const day = now.slice(0, 10);

for (const src of cfg.sources.filter(s => s.enabled)) {
  const adapter = adapters[src.kind];
  if (!adapter) { console.warn('unknown adapter', src.kind); continue; }
  let items;
  try { items = await adapter(src); } catch (e) { console.warn(`[${src.id}] failed: ${e.message}`); continue; }  // a failing source never deletes data
  for (const it of items) {
    const src1 = { label: src.label, url: it.url || src.url };
    const cur = byId.get(it.id);
    if (it.kind === 'lead') {                       // news item: goes in as an unconfirmed lead, never as a release
      if (!cur) { const p = { id: it.id, ...it.product, confidence: 'rumour', status: 'upcoming', record: 'lead', firstSeen: day, lastVerified: day, sources: [src1], pharmacies: [], terpenes: [], aroma: [], irradiated: 'unknown', stock: 'unknown' }; db.products.push(p); byId.set(p.id, p); emit('rumour', p); }
      continue;
    }
    if (!cur) {
      const p = { id: it.id, terpenes: [], aroma: [], origin: null, genetics: null, form: 'flower', irradiated: 'unknown', ...it.product, status: 'released', confidence: 'confirmed', record: 'listing', firstSeen: day, releaseDate: day, lastVerified: day, sources: [src1], pharmacies: src.pharmacy ? [src.pharmacy] : [] };
      db.products.push(p); byId.set(p.id, p); emit('new_listing', p); continue;
    }
    // existing product: price / stock / verification
    if (cur.confidence !== 'confirmed' && it.kind !== 'lead') { cur.confidence = 'confirmed'; cur.status = 'released'; cur.releaseDate ||= day; emit('new_listing', cur); }
    const np = it.product;
    if (np.pricePerGram != null && cur.pricePerGram != null && np.pricePerGram !== cur.pricePerGram) { emit('price_change', cur, { from: cur.pricePerGram, to: np.pricePerGram }); cur.previousPricePerGram = cur.pricePerGram; cur.priceChangedOn = day; }
    if (np.pricePerGram != null) cur.pricePerGram = np.pricePerGram;
    if (np.stock) {
      if ((cur.stock === 'out' || cur.stock === 'discontinued') && np.stock !== 'out') { emit('restock', cur); cur.lastRestock = day; }
      cur.stock = np.stock;
    }
    for (const k of ['thc', 'cbd', 'irradiated']) if (np[k] != null && np[k] !== 'unknown') cur[k] = np[k];
    cur.lastVerified = day;
    if (src.pharmacy && !cur.pharmacies.includes(src.pharmacy)) cur.pharmacies.push(src.pharmacy);
    if (!cur.sources.some(s => s.url === src1.url)) cur.sources.push(src1);
  }
}
// de-dupe events by id so reruns on the same day are idempotent
const have = new Set(evDb.events.map(e => e.id));
const fresh = newEvents.filter(e => !have.has(e.id));
db.generatedAt = now; if (cfg.ntfyTopic) db.ntfyTopic = cfg.ntfyTopic;
console.log(`${fresh.length} new events`, fresh.map(e => `${e.type}:${e.productId}`).join(', '));
if (dry) process.exit(0);
evDb.events = [...fresh, ...evDb.events].slice(0, 500);
writeFileSync('data/products.json', JSON.stringify(db, null, 1));
writeFileSync('data/events.json', JSON.stringify(evDb, null, 1));
if (cfg.ntfyTopic && fresh.length) {
  const text = fresh.map(e => `${e.type.replace('_', ' ')}: ${byId.get(e.productId)?.name}`).join('\n');
  await fetch(`https://ntfy.sh/${cfg.ntfyTopic}`, { method: 'POST', body: text, headers: { Title: 'Leafwatch UK update' } }).catch(e => console.warn('ntfy failed', e.message));
}
