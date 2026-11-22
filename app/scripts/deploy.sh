#!/usr/bin/env bash
# Build the app and publish dist/ to the gh-pages branch (served by GitHub Pages).
# Usage: npm run deploy
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
SOURCE_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
NAME="$(git -C "$REPO_ROOT" config user.name)"
EMAIL="$(git -C "$REPO_ROOT" config user.email)"

if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- app)" ]; then
  echo "app/ has uncommitted changes — commit them first so the deploy matches a commit." >&2
  exit 1
fi

npm run build && npm run build:demo
touch dist/.nojekyll
test -f dist/demo/index.html

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
cp -R dist/. "$OUT"
cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy ${SOURCE_SHA}"
git push -q -f "$REMOTE_URL" gh-pages
echo "Deployed ${SOURCE_SHA} to gh-pages."
