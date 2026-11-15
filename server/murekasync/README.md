# murekasync

A small relay for listening together in the Mureka Player app. One player
shares what it plays, any number of players listen along, each in its own
place, within about a second of each other. Those listening along may pause,
skip, seek and put songs in the shared queue, for everyone.

Every player only connects out to the relay. Nothing connects to a player,
and its web view stays closed to everyone else. Meant to run on a VPN
server, reachable only over the VPN. The traffic is plain HTTP, the VPN
carries it encrypted.

No dependencies beyond the Go standard library, nothing kept on disk.

## Build and install (Alpine)

From the top of the repository, `make server` builds
`server/murekasync/murekasync`, static, for Linux on x86-64.
`SERVER_ARCH=arm64` (and `SERVER_OS`) builds it for another machine, so it
can be built on a workstation and the one file copied over. On the server:

```sh
install -m 755 murekasync /usr/local/bin/murekasync
install -m 755 murekasync.initd /etc/init.d/murekasync
install -m 644 murekasync.confd /etc/conf.d/murekasync
rc-update add murekasync default
rc-service murekasync start
```

Or from the workstation, after `make server`, with `install.sh` in this
folder: `-n` for a new install, `-u` for an update, which keeps the
settings on the server, then the server's address. `-l` and `-p` give
another login and ssh port:

```sh
server/murekasync/install.sh -n 10.0.0.1
server/murekasync/install.sh -u 10.0.0.1
```

`murekasync.initd` is the OpenRC service, run under supervise-daemon so it
is started again should it stop, logging to `/var/log/murekasync.log`, as
the user nobody. `murekasync.confd` holds its settings, set to the
interface wg0 and port 8095, to change as needed.

It listens on the addresses of the VPN interface only (`-interface wg0
-port 8095`), so it is not reachable from the internet, and waits up to two
minutes (`-wait`) for the interface to come up and get an address. One
address instead: `MUREKASYNC_LISTEN="10.0.0.1:8095"` (`-listen`), with
`MUREKASYNC_INTERFACE` left out. Let the firewall pass the port from the
VPN peers that may listen along.

Building it on Ubuntu needs Go 1.21 or newer: `sudo apt install golang-go`.

In the app: Settings > Listening together, the relay's address, for
example `http://10.0.0.1:8095`.

## How it works

- `GET /time`: the relay's time in milliseconds, `{"t": ...}`. Every answer
  carries it, and the players use it as their common clock.
- `POST /room/<room>` with the header `X-Room-Key`: the sharing player's
  state, any JSON up to 64 kB. The first post opens the room and ties it to
  the key (kept as a SHA-256 hash), later posts need the same key. Answered
  with the number of players listening.
- `DELETE /room/<room>` with the same key: the player stopped sharing. The
  listeners get an `end` event.
- `GET /room/<room>/events`: a server-sent event stream. The last state at
  once, then each new one as `event: state` with
  `{"t": <relay time sent>, "at": <relay time received>, "state": {...}}`,
  a comment line every 15 s, and `event: end` when the room closes.
- `POST /room/<room>/cmd`: a command from a player listening along, any
  JSON object up to 8 kB (pause, skip, a song to play next, its timing),
  handed on to the sharing player. 409 while the sharing player is not
  reading its commands, at most 20 a second a room.
- `GET /room/<room>/cmds` with the room's key: the sharing player's stream
  of commands, each as `event: cmd` with
  `{"t": ..., "at": <relay time received>, "cmd": {...}}`. It applies them,
  and the state that follows goes out to everyone.
- `GET /rooms`: the open rooms with the sharing player's name, the song
  and whether it plays, for picking one to listen along with.

A room nobody posted to for 10 minutes closes. At most 64 rooms and 32
listeners a room. Room names are 1 to 40 lower case letters, digits and
hyphens.
