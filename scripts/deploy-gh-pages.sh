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
# Pushes made with GITHUB_TOKEN don't trigger a Pages build on their own, so request one.
if [ -n "${GH_TOKEN:-}" ]; then
  curl -fsS -X POST -H "Authorization: Bearer ${GH_TOKEN}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPOSITORY}/pages/builds" >/dev/null && echo "Pages build requested"
fi
