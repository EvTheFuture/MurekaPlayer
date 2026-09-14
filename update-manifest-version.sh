#!/bin/sh
#

new_version=$(grep "const VERSION = " src/player.js | sed 's/^[^"]*"//g;s/".*$//g')
test -z "$new_version" && echo "ERROR: No versoin found!" && exit 1

sed -i "s/\"version\":.*$/\"version\": \"$new_version\",/g" manifest.json

echo "Version updated to '$new_version'"

