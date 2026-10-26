#!/usr/bin/env bash
# Screenshot Superset's main window without focusing it (it may sit behind other windows,
# not minimized). Needs Screen Recording permission for the app running this shell.
#
#   shot.sh out.png            # the whole window
#   shot.sh out.png sidebar    # just the left sidebar
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:?usage: shot.sh out.png [sidebar]}"
[ -x "$HERE/bin/winid" ] || swiftc -O "$HERE/winid.swift" -o "$HERE/bin/winid"
# The main window is the largest normal-layer window Superset owns.
# Vector's windows are owned by "Vector" (its display name); stock Superset's by "Superset".
ID="$({ "$HERE/bin/winid" Vector; "$HERE/bin/winid" Superset; } | sort -k3,3nr -k4,4nr | awk 'NR==1{print $1}')"
[ -n "$ID" ] || { echo "no Vector or Superset window" >&2; exit 1; }
screencapture -x -o -l "$ID" "$OUT"
if [ "${2:-}" = sidebar ]; then
  magick "$OUT" -crop 740x+0+0 +repage "$OUT"
fi
echo "$OUT"
