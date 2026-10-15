# Leafwatch UK

A mobile-first tracker for new UK medical cannabis releases, restocks and price changes. Original design and code; not affiliated with any other tracker.

**Pages**: New releases dashboard · Browse + advanced filters · Stock tracker · Compare · Watchlist · Alerts · Product pages with source links and last-verified dates.

## Honest labelling
Every item is **Confirmed**, **Announced** or **Rumour**; news-derived leads are never auto-promoted to a release. Unknown fields stay blank (no guessing). Records marked **Sample** are fictional demo data.

## Run
```
npm run build      # -> dist/ (+ dist/preview.html, a single-file version)
npm run serve      # http://localhost:8080
```
Deployed to GitHub Pages by `.github/workflows/pages.yml` (enable Settings → Pages → Source: GitHub Actions).

## Keeping data fresh
1. List sources in `data/sources.json` (`json` feeds/APIs, `rss` news feeds; add adapters in `scripts/adapters.mjs`). Only use sources you may legitimately read; respect terms and robots.txt.
2. `scripts/update.mjs` diffs each fetch against `data/products.json` and writes `data/events.json` (new listing, restock, price change, rumour). A failing source never deletes data.
3. `.github/workflows/update-data.yml` runs it every 6 hours and commits; the commit redeploys the site.
4. Set `ntfyTopic` in `data/sources.json` to push events to phones via ntfy.sh.
5. Human review: leads from news feeds arrive as Rumours; edit `data/products.json` to promote them with a source link once verified.

Not medical advice. UK medical cannabis is prescription-only.
