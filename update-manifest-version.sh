#!/bin/sh
#
# Sets manifest.json's version to the player's VERSION. Written to a new
# file and moved over the old one, as sed -i takes different arguments in
# GNU sed, BusyBox and macOS

new_version=$(grep "const VERSION = " src/player.js | sed 's/^[^"]*"//g;s/".*$//g')
test -z "$new_version" && echo "ERROR: No version found!" && exit 1

sed "s/\"version\":.*$/\"version\": \"$new_version\",/g" manifest.json > manifest.json.new && mv manifest.json.new manifest.json

echo "Version updated to '$new_version'"
