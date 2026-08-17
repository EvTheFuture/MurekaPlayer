#!/bin/sh
#
# Build the Mureka Player add-on package for addons.mozilla.org
#
# Only the files the manifest actually references go into the archive. The web
# directory is deliberately excluded: it holds the iOS Safari bookmarklet, which
# loads the player from a remote host by design. That is fine for a bookmarklet
# but counts as remote code execution inside an add-on, and the minified copies
# there also read as an unattributed third party library to a reviewer.
#
# The bookmarklet is unaffected. It keeps living in the repository and keeps
# being served from jsDelivr and GitHub Pages, so nothing changes on iPhone.

set -e

OUT="mureka-player.zip"

# Refuse to build if the manifest and the player disagree on the version
MANIFEST_VERSION=$(grep -m1 '"version"' manifest.json | cut -d'"' -f4)
PLAYER_VERSION=$(grep -m1 'const VERSION' src/player.js | cut -d'"' -f2)

if [ "$MANIFEST_VERSION" != "$PLAYER_VERSION" ]; then

    echo "Version mismatch: manifest.json is $MANIFEST_VERSION, player.js is $PLAYER_VERSION"
    exit 1
fi

rm -f "$OUT"

# Package only what the manifest declares, plus the icons it points at
zip -r -q "$OUT" \
    manifest.json \
    src/player.js \
    src/content.js \
    src/background.js \
    icons

echo "Built $OUT at version $MANIFEST_VERSION"
echo

# Fail loudly if anything that triggered the previous rejection slipped in
echo "Checking the archive"

if unzip -l "$OUT" | grep -qE "web/|\.min\.js"; then

    echo "FAIL: the archive contains web/ or a minified file"
    exit 1
fi

if unzip -p "$OUT" "src/*.js" | grep -qE "cdn\.jsdelivr|github\.io|eval\(|new Function\("; then

    echo "FAIL: the archive loads or evaluates remote code"
    exit 1
fi

echo "PASS: self contained, no remote code, no minified files"
unzip -l "$OUT"
