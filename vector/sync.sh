#!/usr/bin/env bash
# Rebase Vector's commits onto the latest upstream Superset and push main; Vector CI checks it.
#
#   vector/sync.sh
#
# main is upstream/main plus Vector's commits on top. A rebase keeps them a short stack
# that reads as "what Vector changes", instead of burying them under merge commits.
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo "uncommitted changes in $(pwd); commit or set them aside first" >&2
  exit 1
fi
git checkout --quiet main
git fetch --quiet upstream main --tags
git fetch --quiet origin
# rerere (on in this repo) replays conflict resolutions made in earlier syncs.
if ! git rebase upstream/main; then
  echo "Vector's commits conflict with upstream. Resolve them, run git rebase --continue," >&2
  echo "then rerun this script to check and push." >&2
  exit 1
fi
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  echo "already on the latest upstream, and pushed"
  exit 0
fi

# Vector CI typechecks and tests the pushed main on GitHub's runners.
git push --quiet --force-with-lease origin main
echo "main is $(git rev-list --count upstream/main..main) Vector commits on upstream $(git rev-parse --short upstream/main)"
