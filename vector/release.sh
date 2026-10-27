#!/usr/bin/env bash
# Bring release/<tag> up to date with Vector's commits and push it; Vector CI builds the app.
#
#   vector/release.sh                  # the release installed in /Applications/Superset.app
#   vector/release.sh desktop-v1.41.0  # a given release tag
#
# release/<tag> is the upstream tag plus Vector's commits (upstream/main..main), made on first
# use and cherry-picked forward after. Then vector/install.sh installs the build CI made.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TREE="${VECTOR_RELEASE_TREE:-$HOME/Programs/vector-release}"
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
MISSING="$(git -C "$REPO" log --reverse --format='%H %s' upstream/main..main |
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
echo "pushed $BRANCH at $(git rev-parse --short HEAD); Vector CI builds it, then run vector/install.sh --wait --restart"
