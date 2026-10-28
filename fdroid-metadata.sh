#!/bin/sh
#
# Write the F-Droid build recipe for the release tagged v<VERSION> to
# fdroid/dev.evthefuture.murekaplayer.yml, in exactly the form fdroiddata's
# rewritemeta keeps, so it can be copied as it is to metadata/ in a fork of
# https://gitlab.com/fdroid/fdroiddata.
#
# F-Droid builds the app from the tag and compares its build with the
# release APK on GitHub, reproducible builds, then ships that APK, signed
# with the release key. The key's SHA-256 is fixed below: an installed app
# only takes updates signed with the same key, so it never changes. When
# the release APK is here as well, its signature is checked against it.
#
# Tag the release first, with android/version.properties and the store
# changelog for its version code already in the tagged commit:
#
#     make version
#     git tag v2.0.1 && git push origin v2.0.1
#     make fdroid
#
# Without a version given, the player's version is used. F-Droid picks up
# every tag that looks like a version, so only releases get v tags.

set -e

APP_ID="dev.evthefuture.murekaplayer"
OUT="fdroid/$APP_ID.yml"
REPO="https://github.com/EvTheFuture/MurekaPlayer"
SIGNING_KEY="0e98be50f56804d94dd0398dd32d62e52969e0f157a499ba09c42c0c8cee95ec"

PLAYER_VERSION=$(sed -n 's/.*const VERSION = "\([^"]*\)".*/\1/p' src/player.js | head -1)
VERSION="${1:-$PLAYER_VERSION}"
TAG="v$VERSION"

if ! COMMIT=$(git rev-parse -q --verify "$TAG^{commit}"); then

    echo "There is no tag $TAG, tag the release first"
    exit 1
fi

# The version and its code as the tag has them, which is where F-Droid
# reads them
PROPS=$(git show "$TAG:android/version.properties" 2>/dev/null || true)
NAME=$(echo "$PROPS" | sed -n 's/^versionName=//p')
CODE=$(echo "$PROPS" | sed -n 's/^versionCode=//p')

if [ "$NAME" != "$VERSION" ] || [ -z "$CODE" ]; then

    echo "android/version.properties in $TAG is not at $VERSION, run make version before tagging"
    exit 1
fi

# The store shows what changed from this file in the tagged commit
CHANGES="fastlane/metadata/android/en-US/changelogs/$CODE.txt"

if ! git cat-file -e "$TAG:$CHANGES" 2>/dev/null; then
    echo "Warning: $CHANGES is not in $TAG, F-Droid shows no changes for this version"
fi

# The release APK, when it is here, has to carry the key F-Droid is told
# to accept, or F-Droid's comparison fails
APK="mureka-player-$VERSION.apk"

if [ -f "$APK" ] && [ -n "$APKSIGNER" ] && [ -x "$APKSIGNER" ]; then

    FOUND=$("$APKSIGNER" verify --print-certs "$APK" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)

    if [ "$FOUND" != "$SIGNING_KEY" ]; then

        echo "$APK is signed with $FOUND, not the release key $SIGNING_KEY"
        exit 1
    fi

    echo "$APK is signed with the release key"
else
    echo "Note: $APK or apksigner not found, the APK's key was not checked"
fi

mkdir -p fdroid

# Written as rewritemeta writes it. The line after Binaries ends in a
# space, the URL is too long for one line and rewritemeta keeps it so
{
    printf '%s\n' \
        "AntiFeatures:" \
        "  NonFreeNet:" \
        "    en-US: Plays and manages songs on mureka.ai, a non-free online service." \
        "Categories:" \
        "  - Multimedia" \
        "License: GPL-3.0-or-later" \
        "AuthorName: EvTheFuture" \
        "SourceCode: $REPO" \
        "IssueTracker: $REPO/issues" \
        "Changelog: $REPO/blob/master/CHANGELOG.md" \
        "Donate: https://www.buymeacoffee.com/EvTheFuture" \
        "" \
        "AutoName: Mureka Player" \
        "" \
        "RepoType: git" \
        "Repo: $REPO.git"
    printf 'Binaries: \n'
    printf '%s\n' \
        "  $REPO/releases/download/v%v/mureka-player-%v.apk" \
        "" \
        "Builds:" \
        "  - versionName: $VERSION" \
        "    versionCode: $CODE" \
        "    commit: $COMMIT" \
        "    subdir: android/app" \
        "    gradle:" \
        "      - yes" \
        "" \
        "AllowedAPKSigningKeys: $SIGNING_KEY" \
        "" \
        "AutoUpdateMode: Version" \
        "UpdateCheckMode: Tags ^v[0-9.]+\$" \
        "UpdateCheckData: android/version.properties|versionCode=(\\d+)|.|versionName=(.+)" \
        "CurrentVersion: $VERSION" \
        "CurrentVersionCode: $CODE"
} > "$OUT"

echo "Wrote $OUT for $TAG, commit $COMMIT, version code $CODE"
