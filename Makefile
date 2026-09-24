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

# The Android build needs a JDK 17 or newer. The newest installed one is
# used unless JAVA_HOME is already set to something suitable
JAVA_HOME ?= $(firstword $(shell ls -d /usr/lib/jvm/java-2[1-9]-openjdk-* /usr/lib/jvm/java-1[7-9]-openjdk-* \
    /Library/Java/JavaVirtualMachines/*/Contents/Home 2>/dev/null | sort -rV))

# Where the Android SDK lives. Ubuntu packages put it here
ANDROID_HOME ?= /usr/lib/android-sdk

APK_DEBUG := android/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := android/app/build/outputs/apk/release/app-release.apk

.PHONY: help all ext android apk debug release install install-debug check version clean distclean

help:
	@echo "Mureka Player $(VERSION)"
	@echo
	@echo "  make all            bump, checks, extension packages and the release APK"
	@echo "  make ext            mureka-player-firefox.zip and -chromium.zip"
	@echo "  make release        the release APK, signed with the debug key"
	@echo "  make debug          the debug APK, same as make apk and make android"
	@echo "  make install        build and install the release APK on the connected phone"
	@echo "  make install-debug  build and install the debug APK on the connected phone"
	@echo "  make check          syntax check the player and compare versions"
	@echo "  make version        bump manifest.json to the player version"
	@echo "  make clean          remove build output, keep the caches"
	@echo "  make distclean      also remove the Gradle and SDK caches in the tree"
	@echo
	@echo "  JAVA_HOME    $(JAVA_HOME)"
	@echo "  ANDROID_HOME $(ANDROID_HOME)"

# The manifest is brought to the player's version first, so a build never
# stops on a version mismatch it could have fixed itself
all: version check ext release
	@echo "Built everything at version $(VERSION)"

# The extension packages, including the version check build.sh does itself
ext:
	./build.sh

# Keep the manifest in step with the player on its own
version:
	./update-manifest-version.sh

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
	echo "Versions agree at $(VERSION)"

# The debug APK goes by three names
android: apk

debug: apk

apk: android/local.properties
	@test -n "$(JAVA_HOME)" || { echo "No JDK 17 or newer found, set JAVA_HOME"; exit 1; }
	cd android && JAVA_HOME="$(JAVA_HOME)" ./gradlew assembleDebug
	@echo "APK: $(APK_DEBUG)"

release: android/local.properties
	@test -n "$(JAVA_HOME)" || { echo "No JDK 17 or newer found, set JAVA_HOME"; exit 1; }
	cd android && JAVA_HOME="$(JAVA_HOME)" ./gradlew assembleRelease
	@echo "APK: $(APK_RELEASE)"

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
	rm -rf android/app/build android/build mureka-player-firefox.zip mureka-player-chromium.zip .build

distclean: clean
	rm -rf android/.gradle android/local.properties android/app/src/main/assets/player.js
