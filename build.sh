#!/bin/sh
#
# Build the Mureka Player add-on packages for addons.mozilla.org and the
# Chrome Web Store, which also covers Vivaldi on Android.
#
# Only the files the manifest actually references go into the archives. The web
# directory is deliberately excluded: it holds the iOS Safari bookmarklet, which
# loads the player from a remote host by design. That is fine for a bookmarklet
# but counts as remote code execution inside an add-on, and the minified copies
# there also read as an unattributed third party library to a reviewer.
#
# The bookmarklet is unaffected. It keeps living in the repository and keeps
# being served from jsDelivr and GitHub Pages, so nothing changes on iPhone.
#
# Only the manifest differs between the two browsers, so the Chromium one is
# generated from the Firefox one rather than kept as a second file that can
# quietly drift out of step.

set -e

FIREFOX_OUT="mureka-player-firefox.zip"
CHROMIUM_OUT="mureka-player-chromium.zip"
BUILD_DIR=".build"

if ! command -v jq >/dev/null 2>&1; then

    echo "jq is required to generate the Chromium manifest, try apk add jq"
    exit 1
fi

# Auto update the manifest version
./update-manifest-version.sh

# Refuse to build if the manifest and the player disagree on the version
MANIFEST_VERSION=$(grep -m1 '"version"' manifest.json | cut -d'"' -f4)
PLAYER_VERSION=$(grep -m1 'const VERSION' src/player.js | cut -d'"' -f2)

if [ "$MANIFEST_VERSION" != "$PLAYER_VERSION" ]; then

    echo "Version mismatch: manifest.json is $MANIFEST_VERSION, player.js is $PLAYER_VERSION"
    exit 1
fi

# The Chrome Web Store only accepts one to four dot separated integers, so a
# development suffix such as the k in 1.4.2k becomes a fourth component. Letters
# are treated as base 26, so the sequence still increases with every build
VERSION_BASE=$(echo "$MANIFEST_VERSION" | sed 's/[^0-9.]*$//')
VERSION_SUFFIX=$(echo "$MANIFEST_VERSION" | sed 's/^[0-9.]*//')

if [ -n "$VERSION_SUFFIX" ]; then

    SUFFIX_NUMBER=$(echo "$VERSION_SUFFIX" | awk '{
        total = 0

        for (i = 1; i <= length($0); i++) {
            total = total * 26 + index("abcdefghijklmnopqrstuvwxyz", substr($0, i, 1))
        }

        print total
    }')

    CHROMIUM_VERSION="$VERSION_BASE.$SUFFIX_NUMBER"
else
    CHROMIUM_VERSION="$VERSION_BASE"
fi

rm -rf "$BUILD_DIR" "$FIREFOX_OUT" "$CHROMIUM_OUT"
mkdir -p "$BUILD_DIR/firefox" "$BUILD_DIR/chromium"

# The files both packages share, exactly what the manifest declares
for target in firefox chromium; do

    mkdir -p "$BUILD_DIR/$target/src"
    cp src/player.js src/content.js src/background.js "$BUILD_DIR/$target/src/"
    cp -r icons "$BUILD_DIR/$target/"
done

# Firefox keeps the manifest exactly as it is written in the repository
cp manifest.json "$BUILD_DIR/firefox/manifest.json"

# Chromium needs a service worker instead of an event page, rejects the gecko
# settings block, and insists on a purely numeric version
jq --arg version "$CHROMIUM_VERSION" '
    del(.browser_specific_settings)
    | .version = $version
    | .background = { "service_worker": .background.scripts[0] }
' manifest.json > "$BUILD_DIR/chromium/manifest.json"

(cd "$BUILD_DIR/firefox" && zip -r -q "../../$FIREFOX_OUT" .)
(cd "$BUILD_DIR/chromium" && zip -r -q "../../$CHROMIUM_OUT" .)

rm -rf "$BUILD_DIR"

echo "Built $FIREFOX_OUT at version $MANIFEST_VERSION"
echo "Built $CHROMIUM_OUT at version $CHROMIUM_VERSION"
echo

# Fail loudly if anything that triggered the previous rejection slipped in
for archive in "$FIREFOX_OUT" "$CHROMIUM_OUT"; do

    echo "Checking $archive"

    if unzip -l "$archive" | grep -qE "web/|\.min\.js"; then

        echo "FAIL: $archive contains web/ or a minified file"
        exit 1
    fi

    if unzip -p "$archive" "src/*.js" | grep -qE "cdn\.jsdelivr|github\.io|eval\(|new Function\("; then

        echo "FAIL: $archive loads or evaluates remote code"
        exit 1
    fi

    echo "PASS: self contained, no remote code, no minified files"
done

echo
echo "Chromium manifest differences:"
unzip -p "$CHROMIUM_OUT" manifest.json | jq -c '{version, background}'
