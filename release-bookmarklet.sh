#!/bin/sh
#
# Pin the release bookmarklet to one tagged release of the player.
#
# The bookmarklet loads src/player.js from jsDelivr at the given tag, and the
# browser only runs it when it hashes to the integrity value written into the
# bookmarklet. Nobody who can change the repository or jsDelivr later can
# change what an installed bookmarklet runs. The other side of that: a new
# release needs a new bookmarklet, the old one keeps loading its own version.
#
# The hash is taken from the file as it is in the tag, not as it is in the
# working tree, so tag the release first:
#
#     git tag v2.0.0 && git push origin v2.0.0
#     ./release-bookmarklet.sh v2.0.0
#
# Without a tag given, v and the player's version are used. The script writes
# web/bookmarklet.min.js, the src and integrity lines of web/bookmarklet.js
# and the release one-liner in README.md. The dev bookmarklet is left alone,
# it keeps loading the newest code from GitHub Pages without a hash.

set -e

VERSION=$(sed -n 's/.*const VERSION = "\([^"]*\)".*/\1/p' src/player.js | head -1)
TAG="${1:-v$VERSION}"

if ! command -v openssl >/dev/null 2>&1; then

    echo "openssl is required, try apk add openssl"
    exit 1
fi

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then

    echo "There is no tag $TAG, tag the release first"
    exit 1
fi

HASH="sha384-$(git show "$TAG:src/player.js" | openssl dgst -sha384 -binary | openssl base64 -A)"
URL="https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@$TAG/src/player.js"
LINE="javascript:(function(){if(window.__murekaPlayerToggle){window.__murekaPlayerToggle();return}var s=document.createElement(\"script\");s.src=\"$URL\";s.integrity=\"$HASH\";s.crossOrigin=\"anonymous\";document.body.appendChild(s)})();"

# The paste ready form
printf '%s\n' "$LINE" > web/bookmarklet.min.js

# The readable source, its two lines that change with each release
sed -i \
    -e "s#^\(    script.src = \).*#\1\"$URL\";#" \
    -e "s#^\(    script.integrity = \).*#\1\"$HASH\";#" \
    web/bookmarklet.js

# The release one-liner in the README, the first javascript: line under the
# Latest release heading
if [ -f README.md ]; then

    awk -v line="$LINE" '
        /^### / { inRelease = ($0 ~ /^### Latest release/) }
        inRelease && !done && /^javascript:/ { print line; done = 1; next }
        { print }
    ' README.md > README.md.new
    mv README.md.new README.md
fi

echo "Pinned the release bookmarklet to $TAG"
echo "  $URL"
echo "  $HASH"

# jsDelivr may take a moment to have a new tag. A hash that differs there
# would make the bookmarklet refuse to run, so it is checked when possible
if command -v curl >/dev/null 2>&1; then

    SERVED="sha384-$(curl -fsSL "$URL" | openssl dgst -sha384 -binary | openssl base64 -A)" || SERVED=""

    if [ "$SERVED" = "$HASH" ]; then
        echo "jsDelivr serves the same file"
    else
        echo "WARNING: jsDelivr does not serve the same file yet, try again in a few minutes before publishing"
    fi
fi
