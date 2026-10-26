#!/usr/bin/env bash
# Install the Vector app Vector CI built for the release the stock app runs.
#
#   vector/install.sh                  # the newest build of release/<installed stock tag>
#   vector/install.sh desktop-v1.41.0  # of a given release
#   vector/install.sh --restart        # also quit and reopen Vector if it is running
#
# Downloads the build job's artifact (a zip of Vector.app) and puts it at
# ~/Applications/Vector.app. Nothing is compiled here.
set -euo pipefail

RESTART=false
TAG=""
for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=true ;;
    *) TAG="$arg" ;;
  esac
done
INSTALLED="$(defaults read /Applications/Superset.app/Contents/Info.plist CFBundleShortVersionString)"
TAG="${TAG:-desktop-v$INSTALLED}"
BRANCH="release/$TAG"
REPO="isaacchacko/vector"
OUT="$HOME/Applications/Vector.app"
# The name Vector builds had before 2026-10-26; replaced on install.
LEGACY="$HOME/Applications/Superset Efforts.app"

RUN="$(gh run list -R "$REPO" --workflow "Vector CI" --branch "$BRANCH" --status success \
  --limit 1 --json databaseId,headSha --jq '.[0] | "\(.databaseId) \(.headSha)"')"
if [ -z "$RUN" ]; then
  echo "no successful Vector CI build of $BRANCH yet; push it with vector/release.sh" >&2
  exit 1
fi
read -r RUN_ID SHA <<<"$RUN"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
gh run download -R "$REPO" "$RUN_ID" --name vector-app --dir "$WORK"
ditto -x -k "$WORK/Vector.zip" "$WORK/app"
BUILT="$(ls -d "$WORK"/app/*.app | head -1)"

running() { pgrep -qf "$OUT/Contents/MacOS/" || pgrep -qf "$LEGACY/Contents/MacOS/"; }
if running; then
  if ! $RESTART; then
    STAGED="$HOME/Applications/.Vector-${SHA:0:10}.app"
    rm -rf "$STAGED" && ditto "$BUILT" "$STAGED"
    echo "downloaded ${SHA:0:10} from $BRANCH; Vector is running, so it was not installed." >&2
    echo "Quit it (⌘Q), then: rm -rf \"$OUT\" \"$LEGACY\" && mv \"$STAGED\" \"$OUT\"" >&2
    echo "(or rerun with --restart)" >&2
    exit 0
  fi
  osascript -e 'tell application id "com.superset.desktop" to quit'
  # With agents running, Vector asks "Are you sure you want to quit?"; wait for the answer.
  for _ in $(seq 1 600); do running || break; sleep 1; done
  if running; then echo "Vector is still running (quit cancelled?); not installed" >&2; exit 1; fi
fi
mkdir -p "$HOME/Applications"
rm -rf "$OUT" "$LEGACY"
ditto "$BUILT" "$OUT"
echo "installed Vector ${SHA:0:10} from $BRANCH at $OUT"
if $RESTART; then open "$OUT"; fi
