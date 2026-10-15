# Leafwatch UK

A mobile-first tracker for new UK medical cannabis releases, restocks and price changes. Original design and code; not affiliated with any other tracker.

**Pages**: New releases dashboard · Browse + advanced filters · Stock tracker · Compare · Watchlist · Alerts · News · Cannabis Cup winners · World laws · Product pages with source links and last-verified dates. A "My pharmacy" setting (default: Medicann) adds an at-my-pharmacy filter.

## Honest labelling
Every item is **Confirmed**, **Announced** or **Rumour**; news-derived leads are never auto-promoted to a release. Unknown fields stay blank (no guessing). Records marked **Sample** are fictional demo data.

## Run
```
npm run build      # -> dist/ (+ dist/preview.html, a single-file version)
npm run serve      # http://localhost:8080
```
Live at https://daviefenton.github.io/uk-medical-cannabis-tracker/ — `.github/workflows/pages.yml` deploys it (Settings → Pages → Source must be "GitHub Actions").

## Sources
| Source | What it feeds | Status |
|---|---|---|
| Medicann (article sitemap) | News | automatic |
| Cannabis Health News, Leafie, Cannabis Industry Council | UK news | automatic (RSS) |
| Business of Cannabis, High Times, MJBizDaily, Cannabis Business Times, Newsweed | International news, cup results, law changes | automatic (RSS) |
| Medicann product list | Products/stock | not public (in-app only) |
| MedBud Wiki | — | not scraped: blocks bots, proprietary; product pages link out instead |
| Reddit | — | robots.txt disallows automated access |
| Instagram / X / TikTok / Facebook | — | no free public API |
| Cup winners (`data/cups.json`), world laws (`data/regulations.json`) | Reference pages | curated; edit `scripts/seed-reference.mjs` and re-run |

`node scripts/probe.mjs <urls>` (or the *Probe sources* workflow) checks whether a new source is reachable and what its robots.txt allows.

## Keeping data fresh
1. List sources in `data/sources.json` (`json` feeds/APIs, `rss` news feeds; add adapters in `scripts/adapters.mjs`). Only use sources you may legitimately read; respect terms and robots.txt.
2. `scripts/update.mjs` diffs each fetch against `data/products.json` and writes `data/events.json` (new listing, restock, price change, rumour). A failing source never deletes data.
3. `.github/workflows/update-data.yml` runs it every 6 hours and commits; the commit redeploys the site.
4. Set `ntfyTopic` in `data/sources.json` to push events to phones via ntfy.sh.
5. Human review: leads from news feeds arrive as Rumours; edit `data/products.json` to promote them with a source link once verified.

Not medical advice. UK medical cannabis is prescription-only.
