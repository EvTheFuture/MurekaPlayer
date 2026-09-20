# Mureka Player for Android

A small app that runs mureka.ai in its own WebView with the shared
`src/player.js`, keeps playing with the screen off, and serves a car page on
the phone's hotspot. The car's browser opens that page and becomes the
remote: now playing, cover, stars, like, play and pause, previous and next,
seeking, shuffle and repeat.

## How it fits together

- **MainActivity** loads https://www.mureka.ai/, tags the page with
  `data-mureka-host="apk"` and injects the player from the app's assets. The
  build copies `../src/player.js` into the assets, so there is only one copy
  of the player.
- **PlayerService** is a foreground service. It keeps the app alive in the
  background, owns the Android media session (lock screen, Bluetooth, steering
  wheel buttons, the car's own now playing) and shows the car page address in
  its notification.
- **CarServer** listens on port 8080. `GET /` is the car page, `GET /state`
  the now playing state, `POST /cmd` runs a command in the player.
- **Hub** passes the player's state out and the commands back in.

## Sound in the car

The car page has a Sound switch:

- **Phone / Bluetooth**, the phone plays and the car speakers get it over
  Bluetooth. The car page is only the remote.
- **This browser**, the car browser plays the song itself. The phone keeps
  playing muted and stays in charge of the queue, the car page follows its
  position. If the car page goes away for 8 seconds, the phone takes the
  sound back.

## Build

Needs JDK 17 or newer and the Android SDK with platform 36. On Ubuntu:

```sh
#!/bin/sh
sudo apt install -y openjdk-21-jdk \
    google-android-platform-36-installer \
    google-android-build-tools-36.0.0-installer \
    google-android-platform-tools-installer
```

From the repository root the Makefile does the rest, it finds the JDK, writes
`local.properties` and runs Gradle:

```sh
#!/bin/sh
make android          # app/build/outputs/apk/debug/app-debug.apk
make install          # and put it on the connected phone
```

Or by hand, from this folder:

```sh
#!/bin/sh
echo "sdk.dir=/usr/lib/android-sdk" > local.properties
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug
```

Ubuntu's own `gradle` package is far too old, the wrapper in this folder
fetches the Gradle it needs. The app version comes from `VERSION` in
`src/player.js`, so there is nothing to bump here.

## Use in the car

1. Switch on the phone's hotspot and connect the car to it.
2. Open the app and start the music.
3. Pull down the notification, it shows the car page address, for example
   `http://192.168.43.1:8080`.
4. Open that address in the car's browser.

## Known limits in this first version

- Google sign in runs in the app's WebView with the WebView markers taken
  out of the user agent. Google may still refuse it.
- Export in the settings (download or share) does not work inside the app
  yet. Import from a file does.
- Anyone on the same network can open the car page and control the player.
  On the phone's own hotspot that is only the car.
