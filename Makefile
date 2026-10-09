# Mureka Player
#
# One entry point for the three things this repository builds: the browser
# extension packages, the Android APK and the checks that keep the version
# in src/player.js, manifest.json and the app in step.
#
# Recipes need real tabs, that is a make rule, not a style choice here.

SHELL := /bin/sh

# The version the whole project follows, read from the shared player
VERSION := $(shell sed -n 's/.*const VERSION = "\([^"]*\)".*/\1/p' src/player.js | head -1)

# The Android build needs a JDK 17 or newer. Unless JAVA_HOME is set
# already, every JDK found is asked for its version and the newest one of
# 17 or later is used: the ones under /usr/lib/jvm on Ubuntu, Alpine and
# most other distributions, the ones on a Mac, and the one javac on the
# PATH belongs to. Worked out once, not for every use
ifeq ($(origin JAVA_HOME),undefined)
JAVA_HOME := $(shell \
    for d in /usr/lib/jvm/* /Library/Java/JavaVirtualMachines/*/Contents/Home \
        "$$(dirname "$$(dirname "$$(readlink -f "$$(command -v javac)" 2>/dev/null)")")"; do \
        if [ -x "$$d/bin/javac" ]; then \
            v=$$("$$d/bin/javac" -version 2>&1 | sed -n 's/^javac \([0-9][0-9]*\).*/\1/p' | head -1); \
            if [ -n "$$v" ] && [ "$$v" -ge 17 ]; then \
                echo "$$v $$(readlink -f "$$d")"; \
            fi; \
        fi; \
    done | sort -rn | head -1 | cut -d' ' -f2-)
endif

# Where the Android SDK lives. Ubuntu packages put it here
ANDROID_HOME ?= /usr/lib/android-sdk

APK_DEBUG := android/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := android/app/build/outputs/apk/release/app-release.apk

# The release APK under the name it is published with, and its checksum
DIST_APK := mureka-player-$(VERSION).apk

# The release key, found the way the Gradle build finds it: a keystore in
# ~/.android that is not the debug one, one with mureka in its name first
KEYSTORE := $(firstword $(shell { ls -1 $$HOME/.android/*.jks $$HOME/.android/*.keystore $$HOME/.android/*.p12 2>/dev/null | grep -i mureka; \
    ls -1 $$HOME/.android/*.jks $$HOME/.android/*.keystore $$HOME/.android/*.p12 2>/dev/null; } | grep -v '/debug\.keystore$$'))

# Where the signing answers are kept, asked for once. Git ignores the file
SIGNING := android/keystore.properties

# keytool of the chosen JDK, to check the password and list the keys
KEYTOOL := $(if $(JAVA_HOME),$(JAVA_HOME)/bin/keytool,keytool)

# The newest apksigner in the SDK, to show who signed the release
APKSIGNER := $(lastword $(shell ls -d $(ANDROID_HOME)/build-tools/*/apksigner 2>/dev/null | sort -V))

.PHONY: help all ext android apk debug release install install-debug signing check version bookmarklet clean distclean

help:
	@echo "Mureka Player $(VERSION)"
	@echo
	@echo "  make all            bump, checks, extension packages and the release APK"
	@echo "  make ext            mureka-player-firefox.zip and -chromium.zip"
	@echo "  make release        the release APK, signed with the release key, as $(DIST_APK)"
	@echo "  make debug          the debug APK, same as make apk and make android"
	@echo "  make install        build and install the release APK on the connected phone"
	@echo "  make install-debug  build and install the debug APK on the connected phone"
	@echo "  make signing        ask again which key signs the APKs"
	@echo "  make check          syntax check the player and compare versions"
	@echo "  make version        bump manifest.json to the player version"
	@echo "  make bookmarklet    pin the release bookmarklet to a tag, TAG=v$(VERSION) unless given"
	@echo "  make clean          remove build output, keep the caches"
	@echo "  make distclean      also remove the Gradle and SDK caches in the tree"
	@echo
	@echo "  JAVA_HOME    $(JAVA_HOME)"
	@echo "  KEYSTORE     $(if $(KEYSTORE),$(KEYSTORE),none found in ~/.android)"
	@echo "  SIGNING      $(if $(wildcard $(SIGNING)),$(SIGNING),asked for on the first build)"
	@echo "  ANDROID_HOME $(ANDROID_HOME)"

# The manifest is brought to the player's version first, so a build never
# stops on a version mismatch it could have fixed itself
all: version check ext release
	@echo "Built everything at version $(VERSION)"

# The extension packages, including the version check build.sh does itself
ext:
	./build.sh

# Keep the manifest in step with the player on its own, and the version
# file F-Droid reads to notice a new release. The code is the one the app
# gets, two digits per part, 2.0.0 is 2000000
VERSION_CODE := $(shell echo "$(VERSION)" | awk -F. '{ c = 0; for (i = 1; i <= 4; i++) c = c * 100 + ($$i + 0); print c }')

version:
	./update-manifest-version.sh
	@printf 'versionName=%s\nversionCode=%s\n' "$(VERSION)" "$(VERSION_CODE)" > android/version.properties
	@echo "android/version.properties at $(VERSION), code $(VERSION_CODE)"

# The release bookmarklet, pinned to a tag with the player's hash. Tag the
# release first
TAG ?= v$(VERSION)

bookmarklet:
	./release-bookmarklet.sh $(TAG)

# The player has to parse, and the manifest has to agree with it. Both are
# cheap, so they run before anything is packaged
check:
	@node --check src/player.js && echo "player.js parses"
	@node --check src/content.js && echo "content.js parses"
	@node --check src/background.js && echo "background.js parses"
	@manifest=$$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' manifest.json | head -1); \
	if [ "$$manifest" != "$(VERSION)" ]; then \
	    echo "Version mismatch: manifest.json is $$manifest, player.js is $(VERSION), run make version"; \
	    exit 1; \
	fi; \
	if ! grep -qx "versionName=$(VERSION)" android/version.properties 2>/dev/null \
	    || ! grep -qx "versionCode=$(VERSION_CODE)" android/version.properties; then \
	    echo "android/version.properties is not at $(VERSION), run make version"; \
	    exit 1; \
	fi; \
	echo "Versions agree at $(VERSION)"

# The debug APK goes by three names
android: apk

debug: apk

apk: android/local.properties $(SIGNING)
	@test -n "$(JAVA_HOME)" || { echo "No JDK 17 or newer found, set JAVA_HOME"; exit 1; }
	cd android && JAVA_HOME="$(JAVA_HOME)" ./gradlew assembleDebug
	@echo "APK: $(APK_DEBUG)"

# Also copied to the name it is published with, next to its SHA-256, and
# the signer is shown. Only ever signed with the release key: without one
# set, or with a debug signed result, it stops and nothing is published
release: android/local.properties $(SIGNING)
	@test -n "$(JAVA_HOME)" || { echo "No JDK 17 or newer found, set JAVA_HOME"; exit 1; }
	@store=$$(sed -n 's/^storeFile=//p' $(SIGNING) | head -1); \
	if [ -z "$$store" ] || [ ! -f "$$store" ]; then \
	    echo "make release signs with the release key only, and none is set. Run make signing"; \
	    exit 1; \
	fi
	cd android && JAVA_HOME="$(JAVA_HOME)" ./gradlew assembleRelease
	@if [ -n "$(APKSIGNER)" ] && JAVA_HOME="$(JAVA_HOME)" $(APKSIGNER) verify --print-certs $(APK_RELEASE) \
	    | grep -q "CN=Android Debug"; then \
	    echo "The release APK came out signed with the debug key, not published"; \
	    exit 1; \
	fi
	cp $(APK_RELEASE) $(DIST_APK)
	{ sha256sum $(DIST_APK) 2>/dev/null || shasum -a 256 $(DIST_APK); } > $(DIST_APK).sha256
	@if [ -n "$(APKSIGNER)" ]; then \
	    JAVA_HOME="$(JAVA_HOME)" $(APKSIGNER) verify --print-certs $(DIST_APK) | grep -E "DN:|SHA-256"; \
	fi
	@echo "APK: $(DIST_APK)"

# The first build asks which keystore signs the APKs, its password and the
# key, checks the password with keytool and keeps the answers in
# android/keystore.properties, readable by you only. Enter at the keystore
# question means no key, the debug key then. make signing asks again
$(SIGNING):
	@umask 077; \
	printf 'Keystore to sign the APKs with, Enter for none [%s]: ' "$(KEYSTORE)"; \
	read -r store; store="$${store:-$(KEYSTORE)}"; \
	case "$$store" in "~/"*) store="$$HOME/$${store#\~/}";; esac; \
	if [ -z "$$store" ]; then \
	    printf '# No release key, the APKs are signed with the debug key\nstoreFile=\n' > $@; \
	    echo "No release key, the debug key signs the APKs. make signing sets one later"; \
	    exit 0; \
	fi; \
	if [ ! -f "$$store" ]; then echo "No such file: $$store"; exit 1; fi; \
	while :; do \
	    printf 'Password for %s: ' "$$store"; stty -echo 2>/dev/null; read -r MUREKA_PW; stty echo 2>/dev/null; echo; \
	    export MUREKA_PW; \
	    if "$(KEYTOOL)" -list -keystore "$$store" -storepass:env MUREKA_PW >/dev/null 2>&1; then break; fi; \
	    echo "Wrong password, or not a keystore"; \
	done; \
	keys=$$("$(KEYTOOL)" -list -keystore "$$store" -storepass:env MUREKA_PW 2>/dev/null \
	    | sed -n 's/^\([^,]*\),.*PrivateKeyEntry.*/\1/p'); \
	alias=$$(echo "$$keys" | grep -x murekaplayer || echo "$$keys" | head -1); \
	printf 'Key to sign with [%s]: ' "$$alias"; read -r answer; alias="$${answer:-$$alias}"; \
	pw=$$(printf '%s' "$$MUREKA_PW" | sed 's/\\/\\\\/g'); \
	{ \
	    printf '%s\n' "# Signing for the Mureka Player APKs, written by make, ignored by git"; \
	    printf 'storeFile=%s\n' "$$store"; \
	    printf 'storePassword=%s\n' "$$pw"; \
	    printf 'keyAlias=%s\n' "$$alias"; \
	    printf 'keyPassword=%s\n' "$$pw"; \
	} > $@; \
	echo "Saved in $@"

# Ask the signing questions again
signing:
	rm -f $(SIGNING)
	$(MAKE) $(SIGNING)

# Written once, and again whenever the SDK moves
android/local.properties:
	@test -d "$(ANDROID_HOME)" || { echo "No Android SDK at $(ANDROID_HOME), set ANDROID_HOME"; exit 1; }
	echo "sdk.dir=$(ANDROID_HOME)" > $@

# Both builds carry the same app id and the same debug key, so either one
# replaces the other on the phone and the app's data stays
install: release
	adb install -r $(APK_RELEASE)

install-debug: apk
	adb install -r $(APK_DEBUG)

clean:
	rm -rf android/app/build android/build mureka-player-firefox.zip mureka-player-chromium.zip .build \
	    mureka-player-*.apk mureka-player-*.apk.sha256

distclean: clean
	rm -rf android/.gradle android/local.properties android/app/src/main/assets/player.js
