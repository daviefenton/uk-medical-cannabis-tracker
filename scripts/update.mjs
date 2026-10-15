// Daily updater: fetch sources -> normalise -> diff against data/products.json -> write products/events -> optional ntfy push.
// Usage: node scripts/update.mjs [--dry] [--sources path] [--now ISO]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { adapters } from './adapters.mjs';
import { createHash } from 'node:crypto';

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
const newsDb = existsSync('data/news.json') ? JSON.parse(readFileSync('data/news.json', 'utf8')) : { items: [] };
const newsSeen = new Set(newsDb.items.map(n => n.url));
const freshNews = [];
// keyword tags drive the News filters and the "UK launch" alert
const TAGS = {
  uk: /\b(UK|U\.K\.|Britain|British|England|Scotland|Wales|NHS|MHRA|Home Office|Jersey|Guernsey|Isle of Man)\b/i,
  // a launch needs both a launch word and a product word, so "launches a report" doesn't count
  launch: { test: t => /\b(launch\w*|now available|debut\w*|arriv\w+|introduc\w+|released?|new)\b/i.test(t) && /\b(strains?|cultivars?|flowers?|products?|range|oils?|vapes?|cartridges?|brand|SKUs?|genetics)\b/i.test(t) },
  regulation: /\b(law|legal\w*|regulat\w*|legislat\w*|reform|reschedul\w*|decriminali[sz]\w*|ban(ned|s)?|licen[cs]\w*|government|parliament|minister|bill)\b/i,
  cup: /\b(cannabis cup|emerald cup|cup winners?|awards?|champion\w*)\b/i,
  medical: /\b(medical|medicinal|patients?|prescri\w+|clinic\w*|pharmac\w+)\b/i
};
const NEWS_KINDS = new Set(['news', 'sitemap']);  // adapters that produce news, not products
const PER_SOURCE_MAX = 30;                          // stop one busy feed flooding the page
const tagsFor = (t, region) => [...Object.entries(TAGS).filter(([, re]) => re.test(t)).map(([k]) => k), ...(region === 'uk' ? ['uk'] : [])].filter((v, i, a) => a.indexOf(v) === i);

for (const src of cfg.sources.filter(s => s.enabled)) {
  const adapter = adapters[src.kind];
  if (!adapter) { console.warn('unknown adapter', src.kind); continue; }
  let items;
  try { items = await adapter(src); } catch (e) { console.warn(`[${src.id}] failed: ${e.message}`); continue; }  // a failing source never deletes data
  if (NEWS_KINDS.has(src.kind)) {
    if (!items.length) console.warn(`[${src.id}] returned no items`);
    items = items.slice(0, PER_SOURCE_MAX);
  }
  for (const it of items) {
    if (it.kind === 'news') {
      if (newsSeen.has(it.url)) continue;
      newsSeen.add(it.url);
      const n = { id: 'n-' + createHash('sha1').update(it.url).digest('hex').slice(0, 12), title: it.title, url: it.url, source: it.source, published: it.published || now, firstSeen: now, summary: it.summary, tags: tagsFor(`${it.title} ${it.summary}`, it.region) };
      freshNews.push(n); continue;
    }
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
const touched = fresh.length || freshNews.length || cfg.sources.some(s => s.enabled && !NEWS_KINDS.has(s.kind));
if (fresh.length || cfg.sources.some(s => s.enabled && !NEWS_KINDS.has(s.kind))) db.generatedAt = now;  // product data refreshed
if (cfg.ntfyTopic) db.ntfyTopic = cfg.ntfyTopic;
console.log(`${freshNews.length} new news items`);
console.log(`${fresh.length} new events`, fresh.map(e => `${e.type}:${e.productId}`).join(', '));
if (dry || !touched) process.exit(0);
evDb.events = [...fresh, ...evDb.events].slice(0, 500);
writeFileSync('data/products.json', JSON.stringify(db, null, 1));
writeFileSync('data/events.json', JSON.stringify(evDb, null, 1));
if (freshNews.length) {
  newsDb.items = [...freshNews, ...newsDb.items].sort((a, b) => (b.published || '').localeCompare(a.published || '')).slice(0, 400);
  writeFileSync('data/news.json', JSON.stringify(newsDb, null, 1));
}
const ukLaunches = freshNews.filter(n => n.tags.includes('uk') && n.tags.includes('launch'));
if (cfg.ntfyTopic && (fresh.length || ukLaunches.length)) {
  const text = [...fresh.map(e => `${e.type.replace('_', ' ')}: ${byId.get(e.productId)?.name}`), ...ukLaunches.map(n => `UK launch news: ${n.title}`)].join('\n');
  await fetch(`https://ntfy.sh/${cfg.ntfyTopic}`, { method: 'POST', body: text, headers: { Title: 'Leafwatch UK update' } }).catch(e => console.warn('ntfy failed', e.message));
}
