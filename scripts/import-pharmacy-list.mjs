// Import a pharmacy product list (text copied from the Medicann app) and diff it against data/products.json.
// Usage: node scripts/import-pharmacy-list.mjs <file> [--pharmacy Medicann] [--date YYYY-MM-DD] [--baseline] [--dry]
//   --baseline  first import: add everything without "new listing" events and drop the fictional sample records
// Later imports emit events: new_listing, price_change, restock, out_of_stock (listed before, missing now).
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const pharmacy = opt('--pharmacy', 'Medicann');
const day = opt('--date', (file.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10));
const baseline = args.includes('--baseline'), dry = args.includes('--dry');
const pslug = pharmacy.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Producer prefixes as they appear in the list -> display name (longest match wins)
const PRODUCERS = { 'PEDANIOS': 'Pedanios', '4C LABS VALUE': '4C Labs', '4C LABS': '4C Labs', 'SUPERSEED': 'Superseed', 'SUPRSD': 'Superseed',
  'GLASS PHARMS': 'Glass Pharms', 'DALGETY': 'Dalgety', 'KASA VERDE': 'Kasa Verde', 'CIRCLE': 'Circle', 'CLEARLEAF': 'Clearleaf', 'LIT': 'LIT',
  'CURA-': 'Cura', 'CURALEAF': 'Curaleaf', 'PLANTATIONS CERES': 'Plantations Cérès', 'UPSTATE': 'Upstate', 'MST MTN': 'Mystery Mountain',
  'MSTRY MTN': 'Mystery Mountain', 'MYSTERY MOUNTAIN': 'Mystery Mountain', 'PN-': 'PN', 'IPS': 'IPS', 'GREYSCALES': 'Greyscales', 'MAMEDICA': 'Mamedica',
  'PURO': 'Puro', 'TFN RPR': 'Tofino Ripper', 'TOFINO RIPPER': 'Tofino Ripper', 'GREEN KARAT': 'Green Karat', 'FTP': 'FTP', 'MDCS': 'MDCS',
  'HIGHGREENS': 'HighGreens', 'CARMEL': 'Carmel', 'VASCO': 'Vasco', 'MUZO': 'Muzo', 'EZD': 'EZD', 'HILLTOP LEAF': 'Hilltop Leaf', 'SUNDAZE': 'Sundaze',
  'TOPZ & POPZ': 'Topz & Popz', 'ECOCANN ACCESS': 'EcoCann Access', 'KALLIE': 'Kallie', 'ROXTON AIR': 'Roxton Air', 'JERSEY CRAFT': 'Jersey Craft',
  'ENUA RESIN': 'Enua', 'ENUA': 'Enua', 'BC GREEN': 'BC Green', 'PHANT': 'Phant', 'FOUR': 'Four', 'KANHA': 'Kanha', 'SAFRICANNA': 'SafriCanna',
  'CAKE & CAVIAR': 'Cake & Caviar', 'GREEN BRITANNIA': 'Green Britannia', 'ALL NATIONS': 'All Nations', 'TNSC': 'TNSC', 'GHOST DROPS': 'Ghost Drops',
  'FIND': 'Find', 'PETAL & BUD': 'Petal & Bud', 'GREENSEAL': 'GreenSeal', 'DR WATSON': 'Dr Watson', 'BXB GENETICS': 'BXB Genetics',
  'CANOPY GROWTH': 'Canopy Growth', 'AAAA LOT420': 'AAAA Lot420', 'JOLLY BOYS': 'Jolly Boys', 'BARONGO': 'Barongo', 'BUUO': 'BUUO',
  "UNCLE ROONEY'S": "Uncle Rooney's", 'ALTA VIDA': 'Alta Vida', 'PEACE NATURALS': 'Peace Naturals' };
const PKEYS = Object.keys(PRODUCERS).sort((a, b) => b.length - a.length);
// aroma family guessed from the strain name only (shown as such in the UI)
const CITRUS = /lemon|lime|orange|tangerine|grapefruit|jaffa|citrus|lemonad|tangie|clementine|mandarin/i;
const DIESEL = /diesel|fuel|\bgas\b|chem/i;
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function parseBlock(lines) {
  let max = null, type = null, header = null;
  if (/^Max:\s*(\d+)/i.test(lines[0])) max = +lines.shift().match(/\d+/)[0];
  const tm = lines[0].match(/^(Indica|Sativa|Hybrid)(?:\s*\|\s*(.+))?$/i);
  if (tm) { type = tm[1][0].toUpperCase() + tm[1].slice(1).toLowerCase(); header = tm[2]?.trim() || null; lines.shift(); }
  const [line, cann, priceLine] = lines;
  const cm = cann?.match(/^THC\s+([\d.]+)\s*(%|mg\/ml|mg\/g|mg)\s*\|\s*CBD\s+([\d.]+)\s*(%|mg\/ml|mg\/g|mg)/i);
  const pm = priceLine?.match(/£\s*([\d.,]+)/);
  if (!line || !cm || !pm) throw new Error('Unrecognised block:\n' + lines.join('\n'));
  const code = (line.match(/\(([A-Z]?\d+)\)\s*$/) || [])[1] || null;
  const form = code?.[0] === 'F' || /^\d/.test(code || '') ? 'flower' : code?.[0] === 'V' ? 'vape' : code?.[0] === 'O' ? 'oil' : code?.[0] === 'P' ? 'pastille'
    : /CARTRIDGE/i.test(line) ? 'vape' : /OIL/i.test(line) ? 'oil' : /PASTILLE/i.test(line) ? 'pastille' : 'flower';
  const up = line.toUpperCase();
  const pkey = PKEYS.find(k => up.startsWith(k));
  const producer = pkey ? PRODUCERS[pkey] : line.split(/\s+/)[0];
  // product name: "... - Name (F123)" or "T28 Name Medical Cannabis ..." or the type-line header
  let lineName = (line.match(/\s-\s*([^()]+?)(?:\s*\((?:Smalls?)\))?\s*\([A-Z]?\d+\)\s*$/i) || [])[1]?.trim()
    || (line.match(/\bT\d{2,3}\s+(.+?)\s+Medical Cannabis/i) || [])[1]?.trim() || '';
  if (/^[\s-]*$/.test(lineName) || /\b(THC|CBD|CANNABIS|FLOWER)\b/i.test(lineName)) lineName = '';
  const head = header && !/^tbc$/i.test(header) ? header : '';
  const tidy = t => t === t.toUpperCase() ? t.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Thc|Cbd)\b/g, m => m.toUpperCase()).replace(/(\d)(Mg|Ml)\b/gi, (m, d, u) => d + u.toLowerCase()).replace(/\/(Ml|G)\b/g, m => m.toLowerCase()) : t;
  const name = lineName || head || tidy(line.replace(/\s*\([A-Z]?\d+\)\s*$/, '').replace(/\s+/g, ' ').trim());
  const genetics = head && lineName && norm(head) !== norm(lineName) && / x /i.test(head) ? head : null;
  const unit = cm[2].toLowerCase(), cunit = cm[4].toLowerCase();
  // Medicann shows "CBD 1%" for flower whose listing says <1% (or gives no CBD at all)
  const cbdLt = /<\s*1%\s*CBD|CBD\s*<\s*1%|CBD\s*[≤<]\s*\d|[≤<]\s*\d+\s*mg\/ml\s*CBD/i.test(line) || (form === 'flower' && +cm[3] === 1 && !/\d\s*%\s*CBD/i.test(line));
  const size = form === 'flower' ? +((line.match(/\((\d+(?:\.\d+)?)\s*g\)/i) || line.match(/\b(\d+(?:\.\d+)?)\s*G\b/) || [])[1] || 10)
    : form === 'vape' ? +((line.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b(?![^(]*\/)/i) || [])[1] || 0) || null
    : form === 'oil' ? +((line.match(/(\d+)\s*ml\b/i) || [])[1] || 0) || null
    : +((line.match(/\((\d+)\)\s*\(P/i) || [])[1] || 0) || null;
  const sizeUnit = form === 'flower' ? 'g' : form === 'oil' ? 'ml' : form === 'pastille' ? 'pcs' : /ML\b/i.test(line) && !/\dg\b/i.test(line) ? 'ml' : 'g';
  const price = +pm[1].replace(',', '');
  const id = `${pslug}-${(code || name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const aroma = form === 'flower' || form === 'vape' ? [CITRUS.test(name) && 'citrus', DIESEL.test(name) && 'diesel'].filter(Boolean) : [];  // pastille flavours aren't terpenes
  return { id, code, name, producer, form, type, genetics, thc: +cm[1], thcUnit: unit === '%' ? undefined : unit, cbd: +cm[3], cbdUnit: cunit === '%' ? undefined : cunit,
    cbdLt: cbdLt || undefined, size, sizeUnit, price, pricePerGram: form === 'flower' && size ? Math.round(price / size * 100) / 100 : null,
    smalls: /small/i.test(line) || undefined, maxPerOrder: max || undefined, aroma, aromaSource: aroma.length ? 'name' : undefined, listing: line };
}

const text = readFileSync(file, 'utf8').replace(/\r/g, '');
const blocks = text.split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length);
const parsed = [];
const skipped = [];
for (const b of blocks) {
  if (/^Products\s*\(\d+\)$/i.test(b[0])) b.shift();
  if (!b.length) continue;
  try { parsed.push(parseBlock([...b])); } catch { skipped.push(b.join(' / ')); }  // stray lines: email signatures, headers, half-copied items
}
if (skipped.length) console.warn(`skipped ${skipped.length} unreadable block(s):\n  ` + skipped.map(x => x.slice(0, 120)).join('\n  '));
if (skipped.length > Math.max(3, parsed.length * 0.05)) throw new Error('Too many unreadable blocks — is this the right file?');
const declared = +(text.match(/Products\s*\((\d+)\)/) || [])[1] || null;
const dupes = parsed.map(p => p.id).filter((x, i, a) => a.indexOf(x) !== i);
if (dupes.length) throw new Error('Duplicate ids: ' + dupes.join(', '));
console.log(`parsed ${parsed.length} products${declared ? ` (list says ${declared})` : ''}`);

const db = JSON.parse(readFileSync('data/products.json', 'utf8'));
const evDb = JSON.parse(readFileSync('data/events.json', 'utf8'));
if (baseline) {
  const sampleIds = new Set(db.products.filter(p => p.record === 'sample').map(p => p.id));
  db.products = db.products.filter(p => !sampleIds.has(p.id));
  evDb.events = evDb.events.filter(e => !sampleIds.has(e.productId));
}
const byId = new Map(db.products.map(p => [p.id, p]));
const ts = `${day}T12:00:00Z`, events = [];
const emit = (type, p, detail = {}) => events.push({ id: `${day}-${type}-${p.id}`, ts, type, productId: p.id, detail });
const source = { label: `${pharmacy} app product list (${day})`, url: pharmacy === 'Medicann' ? 'https://www.medicann.co.uk/' : null };
const seen = new Set();
for (const n of parsed) {
  seen.add(n.id);
  const { listing, ...fields } = n;
  const cur = byId.get(n.id);
  if (!cur) {
    const p = { ...fields, irradiated: 'unknown', terpenes: [], origin: null, status: 'released', confidence: 'confirmed', stock: 'in_stock', record: 'pharmacy-list',
      releaseDate: baseline ? null : day, firstSeen: day, lastVerified: day, pharmacies: [pharmacy], sources: [source], listing };
    db.products.push(p); byId.set(p.id, p);
    if (!baseline) emit('new_listing', p);
    continue;
  }
  if (cur.price != null && cur.price !== n.price) { emit('price_change', cur, { from: cur.pricePerGram ?? cur.price, to: n.pricePerGram ?? n.price, unit: n.pricePerGram != null ? 'g' : 'pack' }); cur.previousPricePerGram = cur.pricePerGram; cur.previousPrice = cur.price; cur.priceChangedOn = day; }
  if (cur.stock === 'out') { emit('restock', cur); cur.lastRestock = day; }
  Object.assign(cur, { ...fields, aroma: cur.aromaSource === 'name' || !cur.aroma?.length ? fields.aroma : cur.aroma }, { stock: 'in_stock', lastVerified: day, listing });
  cur.sources = [source, ...(cur.sources || []).filter(s => !s.label.startsWith(`${pharmacy} app product list`))];
}
// previously listed at this pharmacy but missing from this list -> out of stock (not discontinued: it may come back)
for (const p of db.products) if (p.record === 'pharmacy-list' && p.pharmacies?.includes(pharmacy) && !seen.has(p.id) && p.stock !== 'out') { p.stock = 'out'; p.outSince = day; emit('out_of_stock', p); }

const have = new Set(evDb.events.map(e => e.id));
const fresh = events.filter(e => !have.has(e.id));
console.log(`${fresh.length} events:`, Object.entries(fresh.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {})).map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
if (dry) process.exit(0);
db.generatedAt = ts;
evDb.events = [...fresh, ...evDb.events].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 1000);
writeFileSync('data/products.json', JSON.stringify(db, null, 1));
writeFileSync('data/events.json', JSON.stringify(evDb, null, 1));
