#!/usr/bin/env bash
# Build Vector as a local app, on the same Superset release the stock app runs.
#
#   vector/build.sh                  # the release installed in /Applications/Superset.app
#   vector/build.sh desktop-v1.41.0  # a given release tag
#
# The build is branch release/<tag>: the tag plus Vector's commits (upstream/main..main).
# The branch is made on first use by cherry-picking those commits, and pushed to origin.
# The result is ~/Applications/Vector.app. Inside it is still "Superset" (same
# app id, product name, ~/.superset, app-support folder and keychain entry), so it shares
# the stock app's settings, sign-in and data. Run one or the other, never both at once.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TREE="${VECTOR_RELEASE_TREE:-$HOME/Programs/vector-release}"
OUT="$HOME/Applications/Vector.app"
# The name Vector builds had before 2026-10-26; replaced on install.
LEGACY="$HOME/Applications/Superset Efforts.app"
INSTALLED="$(defaults read /Applications/Superset.app/Contents/Info.plist CFBundleShortVersionString)"
TAG="${1:-desktop-v$INSTALLED}"
BRANCH="release/$TAG"

git -C "$REPO" fetch --quiet upstream "refs/tags/$TAG:refs/tags/$TAG"
git -C "$REPO" fetch --quiet origin
if [ -d "$TREE" ]; then
  git -C "$REPO" worktree remove --force "$TREE"
fi
if git -C "$REPO" rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
  git -C "$REPO" worktree add --quiet -B "$BRANCH" "$TREE" "origin/$BRANCH"
else
  git -C "$REPO" worktree add --quiet -B "$BRANCH" "$TREE" "$TAG"
fi
cd "$TREE"

# Vector's commits the branch lacks, matched by subject: rebasing main changes their
# hashes, and a conflict resolved for an older release changes their patch.
ON_BRANCH="$(git log --format=%s "$TAG..HEAD")"
MISSING="$(git log --reverse --format='%H %s' upstream/main..main |
  while read -r sha subject; do grep -qxF "$subject" <<<"$ON_BRANCH" || echo "$sha"; done)"
if [ -n "$MISSING" ]; then
  # rerere (on in this repo) replays conflict resolutions made for an earlier release.
  if ! git cherry-pick $MISSING; then
    echo "Vector's commits conflict with $TAG. Resolve them in $TREE, run" >&2
    echo "git cherry-pick --continue and git push origin $BRANCH there, then rerun this script." >&2
    exit 1
  fi
fi
git push --quiet -u origin "$BRANCH"

bun install --frozen
# Vector's strings are not in upstream's catalogs; a release build would show their ids.
(cd packages/i18n && bun run extract >/dev/null && python3 "$REPO/vector/fill-translations.py" locales)
cd apps/desktop
bun run typecheck
bun test src/shared/efforts.test.ts src/lib/trpc/routers/efforts \
  src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar

# A release build: production URLs are the defaults. Nothing from this shell's Superset
# session may leak in (it would change the data folder or point at a dev backend).
for var in $(env | grep -oE '^SUPERSET_[A-Z_]+'); do unset "$var"; done
export SUPERSET_WORKSPACE_NAME=superset NODE_ENV=production
bun run install:deps
bun run clean:dev
bun run compile:app
bun run copy:native-modules
bun run validate:native-runtime
# Upstream signs and notarizes with Superset's Apple account; this one is signed ad hoc.
CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --config electron-builder.ts --publish never \
  --mac dir --arm64 -c.mac.notarize=false -c.mac.identity=-

BUILT="$TREE/apps/desktop/$(ls -d release/mac-arm64/*.app | head -1)"
if pgrep -qf "$OUT/Contents/MacOS/" || pgrep -qf "$LEGACY/Contents/MacOS/"; then
  echo "built $BUILT from $BRANCH; Vector is running, so it was not installed." >&2
  echo "Quit it (⌘Q), then: rm -rf \"$OUT\" \"$LEGACY\" && cp -R \"$BUILT\" \"$OUT\"" >&2
  exit 0
fi
mkdir -p "$HOME/Applications"
rm -rf "$OUT" "$LEGACY"
cp -R "$BUILT" "$OUT"
echo "built $OUT from $BRANCH"
