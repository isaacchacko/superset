#!/usr/bin/env python3
"""Give every untranslated message in the Lingui catalogs its English text.

Vector's strings are new to upstream's catalogs. Without an entry, a release
build shows Lingui's message id (e.g. "070kfV") instead of the text, and the strict
compile fails on the missing translations.
"""
import pathlib
import re
import sys

ENTRY = re.compile(r'^msgid "(.*)"\nmsgstr ""\n(?!")', re.M)

for po in pathlib.Path(sys.argv[1]).glob("*/messages.po"):
    text = po.read_text()
    filled = ENTRY.sub(lambda m: f'msgid "{m[1]}"\nmsgstr "{m[1]}"\n', text)
    if filled != text:
        po.write_text(filled)
