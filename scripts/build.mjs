// Assemble dist/ for GitHub Pages, plus dist/preview.html (everything inlined, one file).
import { mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/data', { recursive: true });
cpSync('site', 'dist', { recursive: true });
cpSync('data', 'dist/data', { recursive: true });
const rd = f => readFileSync(f, 'utf8');
const data = { products: JSON.parse(rd('data/products.json')), events: JSON.parse(rd('data/events.json')) };
const js = rd('site/app.js'), css = rd('site/style.css');
let html = rd('site/index.html')
  .replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>window.__DATA__=${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>`);
writeFileSync('dist/preview.html', html);
console.log('built dist/ and dist/preview.html', (html.length / 1024).toFixed(0) + 'KB');
