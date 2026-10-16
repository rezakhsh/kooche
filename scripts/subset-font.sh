#!/usr/bin/env bash
# Rebuilds src/app/fonts/Vazirmatn-subset.woff2 from the pinned `vazirmatn` devDependency.
# The variable font is kept (all weights in one file), cut down to Persian/Arabic, ZWNJ and the
# Latin and punctuation we use. Run after `npm install` when the vazirmatn version changes:
#   ./scripts/subset-font.sh
set -euo pipefail
cd "$(dirname "$0")/.."

src='node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2'
out='src/app/fonts/Vazirmatn-subset.woff2'
unicodes='U+0020-007E,U+00A0,U+00AB,U+00BB,U+00D7,U+0600-06FF,U+200C-200F,U+2010-2027,U+2066-2069,U+20AC'

docker run --rm -v "$PWD":/work -w /work python:3.13-slim sh -c "
  pip install --quiet --root-user-action=ignore fonttools brotli &&
  pyftsubset '$src' --unicodes='$unicodes' --layout-features='*' --flavor=woff2 --output-file='$out'"
cp node_modules/vazirmatn/OFL.txt src/app/fonts/OFL.txt
ls -l "$out"
