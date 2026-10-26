#!/usr/bin/env bash
# Build the Vector app from the checkout it runs in; prints the built .app's path last.
# Vector CI's build job runs it on GitHub's macOS runners; vector/build.sh runs it locally.
#
#   vector/build-app.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bun install --frozen
# Vector's strings are not in upstream's catalogs; a release build would show their ids.
(cd packages/i18n && bun run extract >/dev/null && python3 "$ROOT/vector/fill-translations.py" locales)
cd apps/desktop

# A release build: production URLs are the defaults. Nothing from a Superset terminal's
# session may leak in (it would change the data folder or point at a dev backend).
for var in $(env | grep -oE '^SUPERSET_[A-Z_]+'); do unset "$var"; done
export SUPERSET_WORKSPACE_NAME=superset NODE_ENV=production
bun run install:deps
bun run clean:dev
# The compile imports generated file icons (upstream's typecheck script used to make them).
bun run generate:icons
# The menus say Vector; productName stays Superset, so the data folder and keychain entry are shared.
DESKTOP_DISPLAY_NAME=Vector bun run compile:app
bun run copy:native-modules
bun run validate:native-runtime
# Upstream signs and notarizes with Superset's Apple account; this one is signed ad hoc.
CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --config electron-builder.ts --publish never \
  --mac dir --arm64 -c.mac.notarize=false -c.mac.identity=- >&2

BUILT="$ROOT/apps/desktop/$(ls -d release/mac-arm64/*.app | head -1)"
# macOS shows another name only through InfoPlist.strings: setting CFBundleName itself makes
# Electron miss its "<CFBundleName> Helper.app" and abort at launch (upstream fixed it this way).
for lproj in "$BUILT"/Contents/Resources/*.lproj; do
  printf '"CFBundleName" = "Vector";\n"CFBundleDisplayName" = "Vector";\n' > "$lproj/InfoPlist.strings"
done
codesign --force --deep --sign - "$BUILT"
echo "$BUILT"
