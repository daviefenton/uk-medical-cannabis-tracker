#!/usr/bin/env bash
# Build dist/ and force-push it to the gh-pages branch (GitHub Pages "Deploy from a branch" mode).
set -euo pipefail
node scripts/build.mjs
touch dist/.nojekyll
url=$(git remote get-url origin)
cd dist
git init -q -b gh-pages
git add -A
git -c user.name="leafwatch-bot" -c user.email="bot@users.noreply.github.com" commit -qm "Deploy $(date -u +%FT%TZ)"
git push -qf "$url" gh-pages
