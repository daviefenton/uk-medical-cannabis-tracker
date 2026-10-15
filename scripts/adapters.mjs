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
