// Source adapters. Each returns [{ id, kind?, url?, product:{...} }]. Add new kinds here.
import { readFileSync } from 'node:fs';
const load = async url => url.startsWith('file:') || !/^https?:/.test(url)
  ? readFileSync(url.replace(/^file:/, ''), 'utf8')
  : (await fetch(url, { headers: { 'user-agent': 'LeafwatchUK/1.0 (+contact in repo README)' } }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }));
const get = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);
const num = v => v == null || v === '' ? null : Number(String(v).replace(/[^\d.]/g, '')) || null;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const adapters = {
  async json(src) {
    const data = JSON.parse(await load(src.url)), m = src.map;
    return get(data, src.itemsPath || '').map?.(r => ({
      id: String(get(r, m.id)), url: m.url && get(r, m.url),
      product: { name: get(r, m.name), producer: get(r, m.producer), thc: num(get(r, m.thc)), cbd: num(get(r, m.cbd)), pricePerGram: num(get(r, m.pricePerGram)),
        stock: ({ instock: 'in_stock', in_stock: 'in_stock', low: 'low', out: 'out', outofstock: 'out' })[String(get(r, m.stock) ?? '').toLowerCase().replace(/\W/g, '')] || null,
        irradiated: ({ no: 'no', yes: 'yes', true: 'yes', false: 'no' })[String(get(r, m.irradiated) ?? '').toLowerCase()] || 'unknown' }
    })) ?? [];
  },
  async rss(src) {                       // news/announcement feeds become unconfirmed leads for human review
    const xml = await load(src.url), out = [];
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const t = (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim();
      const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim();
      if (t && src.keywords.some(k => t.toLowerCase().includes(k))) out.push({ id: 'lead-' + slug(t).slice(0, 50), kind: 'lead', url: link, product: { name: t, producer: src.label, form: 'flower', thc: null, cbd: null, pricePerGram: null } });
    }
    return out;
  }
};

// News feeds (RSS/Atom) -> plain news items for the News page. Never turned into products.
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|ldquo|rdquo|hellip|ndash|mdash);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—' })[e])
  .replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ''; };
adapters.news = async src => {
  const xml = await load(src.url), out = [];
  for (const [, item] of xml.matchAll(/<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/g)) {
    const title = tag(item, 'title');
    const link = tag(item, 'link') || (item.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    if (!title || !/^https?:/.test(link)) continue;
    const date = tag(item, 'pubDate') || tag(item, 'published') || tag(item, 'updated') || tag(item, 'dc:date');
    const summary = (tag(item, 'description') || tag(item, 'summary')).slice(0, 280);
    out.push({ kind: 'news', title, url: link, published: date ? new Date(date).toISOString() : null, summary, source: src.label, region: src.region || null });
  }
  return out;
};

// Sitemap of articles (for sites without RSS, e.g. Medicann). Titles come from the URL slug; newest first.
adapters.sitemap = async src => {
  const xml = await load(src.url);
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, u]) => ({ loc: tag(u, 'loc'), lastmod: tag(u, 'lastmod') }))
    .filter(e => e.loc && (!src.pathPrefix || new URL(e.loc).pathname.startsWith(src.pathPrefix)));
  const seen = new Set();
  return entries.filter(e => !seen.has(e.loc) && seen.add(e.loc)).slice(0, src.max || 20).map(e => {
    const slug = new URL(e.loc).pathname.split('/').filter(Boolean).pop().replace(/^-+/, '');
    const title = slug.replace(/-/g, ' ').replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1$2').replace(/^./, c => c.toUpperCase());
    // fall back to a date written in the slug, e.g. "...-roundup-9-october-2026"
    const d = slug.match(/(\d{1,2})(?:st|nd|rd|th)?-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{4})/);
    const published = e.lastmod ? new Date(e.lastmod).toISOString() : d ? new Date(`${d[1]} ${d[2]} ${d[3]} 12:00 UTC`).toISOString() : null;
    return { kind: 'news', title, url: e.loc, published, summary: '', source: src.label, region: src.region || null };
  });
};
