#!/bin/sh
#
# Write the web view's page into the player, between the WEBVIEW PAGE
# markers in src/player.js, so the add-on and the bookmarklet carry it with
# no file of their own: one hash covers both, and nothing is fetched. The
# app serves the page itself and copies the player without it.
#
# The page is kept as it is, in a String.raw template, readable for a
# reviewer. It may hold no backtick and no dollar brace, which would end or
# open the template, and that is checked.
#
#   ./embed-webview.sh                    write the page into the player
#   ./embed-webview.sh --check            only compare, fail when it differs
#   ./embed-webview.sh --check P W        the same for other copies, the git
#                                         index's in the pre-commit hook

set -e

MODE="write"

if [ "$1" = "--check" ]; then

    MODE="check"
    shift
fi

PLAYER="${1:-src/player.js}"
PAGE="${2:-android/app/src/main/assets/webview.html}"

BEGIN_LINE="    // BEGIN WEBVIEW PAGE"
END_LINE="    // END WEBVIEW PAGE"

for f in "$PLAYER" "$PAGE"; do

    if [ ! -f "$f" ]; then

        echo "embed-webview: $f is missing"
        exit 1
    fi
done

# Both markers once each, in the player only
if [ "$(grep -cx "$BEGIN_LINE" "$PLAYER")" != "1" ] || [ "$(grep -cx "$END_LINE" "$PLAYER")" != "1" ]; then

    echo "embed-webview: $PLAYER needs the lines '$BEGIN_LINE' and '$END_LINE' once each"
    exit 1
fi

if grep -q -e '`' -e '\${' "$PAGE"; then

    echo "embed-webview: $PAGE has a backtick or a dollar brace, which a String.raw template cannot hold"
    grep -n -e '`' -e '\${' "$PAGE" | head -5
    exit 1
fi

if grep -q -x -e "$BEGIN_LINE" -e "$END_LINE" "$PAGE"; then

    echo "embed-webview: $PAGE holds a marker line of the player"
    exit 1
fi

OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT

# Everything outside the markers as it is, the page in between
awk -v page="$PAGE" -v begin_line="$BEGIN_LINE" -v end_line="$END_LINE" '
    $0 == begin_line {

        print
        print "    // Written by embed-webview.sh from android/app/src/main/assets/webview.html."
        print "    // Change that file and run make embed, never the lines up to END WEBVIEW PAGE"
        printf "    const WEBVIEW_PAGE = String.raw`"

        while ((getline line < page) > 0) {
            print line
        }

        close(page)
        print "`;"
        skip = 1
        next
    }

    $0 == end_line {
        skip = 0
    }

    !skip {
        print
    }
' "$PLAYER" > "$OUT"

if [ "$MODE" = "check" ]; then

    if cmp -s "$OUT" "$PLAYER"; then

        echo "The web view's page in $PLAYER is the current one"
        exit 0
    fi

    echo "The web view's page in $PLAYER is not the current $PAGE, run make embed"
    exit 1
fi

if cmp -s "$OUT" "$PLAYER"; then

    echo "The web view's page in $PLAYER was current already"
    exit 0
fi

cat "$OUT" > "$PLAYER"
echo "Wrote the web view's page into $PLAYER"
