#!/usr/bin/env bash
# Build Vector here instead of in CI: release/<tag> brought up to date, built locally, installed.
# Prefer vector/release.sh then vector/install.sh, which build on GitHub's runners.
#
#   vector/build.sh                  # the release installed in /Applications/Superset.app
#   vector/build.sh desktop-v1.41.0  # a given release tag
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TREE="${VECTOR_RELEASE_TREE:-$HOME/Programs/vector-release}"
OUT="$HOME/Applications/Vector.app"
# The name Vector builds had before 2026-10-26; replaced on install.
LEGACY="$HOME/Applications/Superset Efforts.app"

"$HERE/release.sh" "$@"
BUILT="$("$TREE/vector/build-app.sh" | tail -1)"
if pgrep -qf "$OUT/Contents/MacOS/" || pgrep -qf "$LEGACY/Contents/MacOS/"; then
  echo "built $BUILT; Vector is running, so it was not installed." >&2
  echo "Quit it (⌘Q), then: rm -rf \"$OUT\" \"$LEGACY\" && cp -R \"$BUILT\" \"$OUT\"" >&2
  exit 0
fi
mkdir -p "$HOME/Applications"
rm -rf "$OUT" "$LEGACY"
cp -R "$BUILT" "$OUT"
echo "built and installed $OUT"
