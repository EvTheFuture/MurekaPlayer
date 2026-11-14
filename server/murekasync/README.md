# murekasync

A small relay for listening together in the Mureka Player app. One player
shares what it plays, any number of players listen along, each in its own
place, within about a second of each other.

The sharing player only posts to the relay, and the players listening along
only read from it. Nothing connects to a player, and its web view stays
closed to everyone else. Meant to run on a VPN server, reachable only over
the VPN. The traffic is plain HTTP, the VPN carries it encrypted.

No dependencies beyond the Go standard library, nothing kept on disk.

## Build and install (Alpine)

```sh
cd server/murekasync
go build -trimpath -ldflags "-s -w" -o murekasync .
install -m 755 murekasync /usr/local/bin/murekasync
install -m 755 murekasync.initd /etc/init.d/murekasync
echo 'MUREKASYNC_LISTEN="10.0.0.1:8095"' > /etc/conf.d/murekasync
rc-update add murekasync default
rc-service murekasync start
```

Use the server's own VPN address in `MUREKASYNC_LISTEN`, so it is not
reachable from the internet, and let the firewall pass that port from the
VPN peers that may listen along.

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
- `GET /rooms`: the open rooms with the sharing player's name, the song
  and whether it plays, for picking one to listen along with.

A room nobody posted to for 10 minutes closes. At most 64 rooms and 32
listeners a room. Room names are 1 to 40 lower case letters, digits and
hyphens.
