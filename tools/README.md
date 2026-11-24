# mureka-cmd

Control Mureka Player on the Android device from a computer: a key bound
in the window manager, a script, a cron job. Browsers give the computer no
volume over MPRIS, so this is the way to the phone's volume from the
keyboard. It also plays, pauses and skips without a browser open.

## How it works

The app's web view server (port 8080) takes commands as `POST /cmd` with a
JSON body `{"cmd": "...", "arg": ...}`. A request with the header
`X-Mureka-Key: <key>` is let in with or without the web view's password.
`GET /ping` answers `{"player":"Mureka Player","key":true|false}`, so a
script can tell the player apart from anything else on that address and
see whether its key is right.

The server only answers on networks where the web view is allowed (the
hotspot, or a Wi-Fi allowed in the settings). The request needs
`Content-Type: application/json`, and the Host must be an IP address, a
`.local` name or localhost.

## Setup

1. In the app: Settings, the web view, Key for scripts, Show and copy.
2. Save the key on the computer:

       printf '%s' '<key>' > ~/.config/mureka-key
       chmod 600 ~/.config/mureka-key

   Or set `MUREKA_KEY` in the environment instead.
3. Put the script in the path:

       install -m 755 tools/mureka-cmd ~/.local/bin/

4. Optional, to find the device by name on a shared Wi-Fi. Alpine uses
   musl, which cannot look up `.local` names by itself, so Avahi does it:

       apk add avahi avahi-tools
       rc-update add avahi-daemon
       rc-service avahi-daemon start

5. Check that the device is found:

       mureka-cmd --find

   It prints the address it found, `10.0.0.1:8080` say.

New key in the app makes another key; scripts with the old one get "The
key was not accepted" until they have the new one.

## Finding the device

The address changes between the hotspot and different Wi-Fi networks, so
the script looks for the device on its own. The first address that
answers `/ping` as Mureka Player wins:

1. `MUREKA_HOST`, when set (an address or a name, port 8080 unless given)
2. the last address that answered, kept in `~/.cache/mureka-phone`
3. `murekaplayer.local` (or `MUREKA_NAME.local`), by `avahi-resolve`, else
   the system's own lookup (`getent hosts`)
4. the default gateway, which is the device itself when the computer is
   on its hotspot
5. `MUREKA_HOSTS`, more addresses separated by spaces
6. every address of each /24 the computer is on, asked at once (about 2 s)

The one found is remembered, so a key press usually costs one request.
When a command later fails at the remembered address, it is forgotten
and the next press looks again. `mureka-cmd --forget` forgets it by hand.

The name is the app's setting "Local name for other devices"; set
`MUREKA_NAME` when it is not `murekaplayer`.

## Usage

    mureka-cmd COMMAND [ARG]
    mureka-cmd --find
    mureka-cmd --forget

ARG is sent as JSON: numbers, `true`, `false`, `null` and anything
starting with `{`, `[` or `"` as they are, anything else as a string.

Exit codes: 0 sent, 1 not found, no key, key refused or another answer
than 200, 2 wrong usage. Errors go to stderr.

## Commands

| Command | Arg | What it does |
|---|---|---|
| `toggle` | | Play or pause |
| `play` | | Play, when paused or stopped |
| `pause` | | Pause, when playing |
| `next` | | Next song |
| `prev` | | Previous song |
| `stop` | | Stop |
| `seekBy` | seconds | Move by that many seconds, negative back |
| `seek` | seconds | Go to that point of the song |
| `like` | | Like or unlike the playing song |
| `rate` | 1 to 5 | The stars, the same cycle as a tap on star n |
| `sysVolumeNudge` | 1 or -1 | One level of more steps up or down; one of Android's own steps when more steps is off |
| `sysVolumeStep` | 1 or -1 | One of Android's own steps up or down, more steps on or not |
| `sysVolume` | step | Android's own step, 0 to the phone's highest |
| `clearQueue` | | Clear the queue while stopped |

Commands only the app itself may send are refused with 403.

## Sway

    bindsym XF86AudioRaiseVolume exec mureka-cmd sysVolumeNudge 1
    bindsym XF86AudioLowerVolume exec mureka-cmd sysVolumeNudge -1
    bindsym Shift+XF86AudioRaiseVolume exec mureka-cmd sysVolumeStep 1
    bindsym Shift+XF86AudioLowerVolume exec mureka-cmd sysVolumeStep -1
    bindsym $mod+XF86AudioPlay exec mureka-cmd toggle
    bindsym $mod+XF86AudioNext exec mureka-cmd next
    bindsym $mod+XF86AudioPrev exec mureka-cmd prev

The plain media keys can stay with the browser's Media keys here (MPRIS,
playerctl), which already plays, pauses and skips on the device; the
volume keys go to mureka-cmd since MPRIS volume never reaches a browser.

## Plain curl

When the address is known, no script is needed:

    curl -s -H "X-Mureka-Key: $(cat ~/.config/mureka-key)" \
        -H "Content-Type: application/json" \
        --data '{"cmd":"sysVolumeNudge","arg":1}' \
        http://10.0.0.1:8080/cmd

## Troubleshooting

- `Mureka Player not found`: the app is not running, the computer is on a
  network where the web view is not allowed, or the device sleeps. Try
  `mureka-cmd --find`, and `curl http://<address>:8080/ping` by hand.
- `The key was not accepted`: copy the key again from the app, a new key
  may have been made.
- `.local` not found: avahi-daemon not running, or the network blocks
  multicast. The gateway and the sweep still find the device.
- The app's debug log (Developer in the settings) shows every command as
  `Command <cmd> <arg>`.
