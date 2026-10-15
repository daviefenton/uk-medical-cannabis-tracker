#!/usr/bin/env bash
# Build dist/ and force-push it to the gh-pages branch (GitHub Pages "Deploy from a branch" mode).
set -euo pipefail
node scripts/build.mjs
touch dist/.nojekyll
if [ -n "${GH_TOKEN:-}" ]; then url="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"; else url=$(git remote get-url origin); fi
cd dist
git init -q -b gh-pages
git add -A
git -c user.name="leafwatch-bot" -c user.email="bot@users.noreply.github.com" commit -qm "Deploy $(date -u +%FT%TZ)"
git push -qf "$url" gh-pages
