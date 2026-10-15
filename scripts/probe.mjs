// Feasibility probe: which candidate sources are reachable, what they return, and what robots.txt says.
// Usage: node scripts/probe.mjs  (prints a report; changes nothing)
const urls = process.argv.slice(2).length ? process.argv.slice(2) : [
  'https://medbud.wiki/', 'https://medicann.co.uk/', 'https://www.medicann.co.uk/', 'https://medicann.uk/', 'https://www.medicann.com/', 'https://medicann.je/', 'https://www.420pharma.im/',
  'https://cannabishealthnews.co.uk/feed/', 'https://businessofcannabis.com/feed/', 'https://leafie.co.uk/feed/', 'https://www.cicouncil.org.uk/feed/', 'https://releaf.co.uk/blog/rss.xml',
  'https://hightimes.com/feed/', 'https://mjbizdaily.com/feed/', 'https://www.cannabisbusinesstimes.com/rss/', 'https://www.leafly.com/news/feed',
  'https://www.reddit.com/r/MedicalCannabisUK/new/.rss', 'https://www.reddit.com/r/ukmedicalcannabis/new/.rss', 'https://www.reddit.com/r/MedCannabisUK/new/.rss',
  'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%22medical%20cannabis%22%20UK&limit=3',
  'https://theemeraldcup.com/', 'https://www.spannabis.com/', 'https://cannabiscup.com/',
];
const UA = 'LeafwatchUK/1.0 (+https://github.com/daviefenton/uk-medical-cannabis-tracker)';
async function get(u) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(+(process.env.TIMEOUT_MS || 30000)) });
    const t = await r.text();
    return { status: r.status, final: r.url, type: (r.headers.get('content-type') || '').split(';')[0], size: t.length, text: t };
  } catch (e) { return { status: 'ERR ' + (e.cause?.code || e.message) }; }
}
const seenRobots = new Set();
for (const u of urls) {
  const r = await get(u);
  const title = r.text?.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
  const items = r.text ? (r.text.match(/<item[\s>]|<entry[\s>]/g) || []).length : 0;
  console.log(`\n== ${u}\n   status=${r.status} type=${r.type || '-'} size=${r.size ?? '-'} final=${r.final || '-'}\n   title=${title || '-'} feedItems=${items}`);
  if (/xml/.test(r.type || '') && /<urlset|<sitemapindex/.test(r.text)) { const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]); console.log(`   sitemap: ${locs.length} urls`); console.log(locs.filter(l => !/\.(jpg|png|webp)$/.test(l)).slice(0, 120).map(l => '     ' + l).join('\n')); }
  if (process.env.SHOW_TEXT && r.text && /html/.test(r.type || '')) console.log('   text:', r.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000));
  if (r.type === 'application/json') console.log('   json:', r.text.slice(0, 300).replace(/\s+/g, ' '));
  const origin = new URL(r.final || u).origin;
  if (typeof r.status === 'number' && !seenRobots.has(origin)) {
    seenRobots.add(origin);
    const rb = await get(origin + '/robots.txt');
    if (rb.status === 200) console.log('   robots.txt:\n' + rb.text.split('\n').filter(l => /^(user-agent|disallow|allow|crawl-delay|sitemap)/i.test(l.trim())).slice(0, 25).map(l => '     ' + l.trim()).join('\n'));
  }
}
