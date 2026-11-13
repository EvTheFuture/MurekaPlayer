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
# Code both the player and the page use lives once, in src/shared/<name>.js.
# It is written into both, between the lines BEGIN SHARED <name> and
# END SHARED <name>, before the page goes into the player.
#
#   ./embed-webview.sh                    write the shared code and the page
#   ./embed-webview.sh --check            only compare, fail when it differs
#   ./embed-webview.sh --check P W D      the same for other copies, the git
#                                         index's in the pre-commit hook

set -e

MODE="write"

if [ "$1" = "--check" ]; then

    MODE="check"
    shift
fi

PLAYER="${1:-src/player.js}"
PAGE="${2:-android/app/src/main/assets/webview.html}"
SHARED="${3:-src/shared}"

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

if [ ! -d "$SHARED" ]; then

    echo "embed-webview: $SHARED is missing"
    exit 1
fi

if grep -q -e '`' -e '\${' "$PAGE" "$SHARED"/*.js; then

    echo "embed-webview: $PAGE or $SHARED has a backtick or a dollar brace, which a String.raw template cannot hold"
    grep -n -e '`' -e '\${' "$PAGE" "$SHARED"/*.js | head -5
    exit 1
fi

if grep -q -x -e "$BEGIN_LINE" -e "$END_LINE" "$PAGE"; then

    echo "embed-webview: $PAGE holds a marker line of the player"
    exit 1
fi

OUT=$(mktemp)
PAGE_OUT=$(mktemp)
MID=$(mktemp)
trap 'rm -f "$OUT" "$PAGE_OUT" "$MID"' EXIT

# The shared code between its markers, in the page and in the player, but
# not in the player's copy of the page, which is written whole below. A
# block whose file is missing, or a block not closed, stops it
SHARED_AWK='
    function shared(name,    file, line, n) {

        file = dir "/" name ".js"
        n = 0

        while ((getline line < file) > 0) {

            print line
            n += 1
        }

        close(file)

        if (n == 0) {

            print "embed-webview: " file " is missing or empty" > "/dev/stderr"
            failed = 1
        }
    }

    $0 == begin_line {
        inpage = 1
    }

    $0 == end_line {
        inpage = 0
    }

    !inpage && !inshared && /^    \/\/ BEGIN SHARED [a-z0-9-]+$/ {

        print
        open_name = $4
        print "    // Written by embed-webview.sh from src/shared/" open_name ".js. Change that"
        print "    // file and run make embed, never the lines up to END SHARED " open_name
        shared(open_name)
        inshared = 1
        next
    }

    inshared && $0 == "    // END SHARED " open_name {

        print
        inshared = 0
        next
    }

    !inshared {
        print
    }

    END {

        if (inshared) {

            print "embed-webview: BEGIN SHARED " open_name " has no END SHARED " open_name > "/dev/stderr"
            exit 1
        }

        if (failed) {
            exit 1
        }
    }
'

awk -v dir="$SHARED" -v begin_line="$BEGIN_LINE" -v end_line="$END_LINE" "$SHARED_AWK" "$PAGE" > "$PAGE_OUT"

# The player's own shared blocks, then everything outside the page's
# markers as it is and the page in between. Kept in files, not a pipe, so a
# failed step stops the script
awk -v dir="$SHARED" -v begin_line="$BEGIN_LINE" -v end_line="$END_LINE" "$SHARED_AWK" "$PLAYER" > "$MID"

awk -v page="$PAGE_OUT" -v begin_line="$BEGIN_LINE" -v end_line="$END_LINE" '
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
' "$MID" > "$OUT"

if [ "$MODE" = "check" ]; then

    if ! cmp -s "$PAGE_OUT" "$PAGE"; then

        echo "The shared code in $PAGE is not the current $SHARED, run make embed"
        exit 1
    fi

    if cmp -s "$OUT" "$PLAYER"; then

        echo "The shared code and the web view's page in $PLAYER are the current ones"
        exit 0
    fi

    echo "The shared code or the web view's page in $PLAYER is not the current one, run make embed"
    exit 1
fi

if ! cmp -s "$PAGE_OUT" "$PAGE"; then

    cat "$PAGE_OUT" > "$PAGE"
    echo "Wrote the shared code into $PAGE"
fi

if cmp -s "$OUT" "$PLAYER"; then

    echo "The shared code and the web view's page in $PLAYER were current already"
    exit 0
fi

cat "$OUT" > "$PLAYER"
echo "Wrote the shared code and the web view's page into $PLAYER"
