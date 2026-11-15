// Mureka Player - load and play all Mureka songs of an account
// Listening together: a small relay for the state of a player that shares
// what it plays, and the players listening along
//
// Copyright (C) 2026 EvTheFuture
// https://github.com/EvTheFuture/MurekaPlayer
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// A sharing player claims a room with a key of its own and posts its state
// to it: the song, where it is, whether it plays and what comes next.
// Players listening along read the room as a stream of events, and may
// post commands to it (pause, skip, a song to play next), which reach the
// sharing player on a stream of its own, read with its key. It applies
// them and the state that follows goes out to all. Nothing connects to a
// player, and the relay keeps nothing on disk. Every answer carries the
// relay's own time in milliseconds, which the players use as their common
// clock
package main

import (
    "context"
    "crypto/sha256"
    "crypto/subtle"
    "encoding/json"
    "flag"
    "fmt"
    "io"
    "log"
    "net"
    "net/http"
    "regexp"
    "sort"
    "strings"
    "sync"
    "time"
)

const (
    // The largest state a sharing player may post, and the largest
    // command
    maxState   = 64 * 1024
    maxCommand = 8 * 1024

    // Commands a room takes in a second at most
    maxCommandsPerSecond = 20

    // Rooms and listeners at most, so a mistake cannot eat the server
    maxRooms     = 64
    maxListeners = 32

    // A room nobody posted to for this long is closed
    roomIdle = 10 * time.Minute

    // A room whose player has posted nothing for this long may be taken
    // over by another player with its own key, so those listening carry on
    // when the player holding it went away without closing it
    takeoverAfter = 20 * time.Second

    // A comment line keeps a quiet stream open through every proxy
    pingEvery = 15 * time.Second
)

// A room name: lower case letters, digits and hyphens
var roomName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,39}$`)

// One room: who may post to it, the last state and those listening
type room struct {
    keyHash   [32]byte
    state     []byte
    stateAt   int64
    postedAt  time.Time
    name      string
    label     string
    title     string
    playing   bool
    listeners map[chan []byte]struct{}
    owners    map[chan []byte]struct{}
    cmdSecond int64
    cmdCount  int
}

type relay struct {
    mu    sync.Mutex
    rooms map[string]*room
}

func nowMs() int64 {
    return time.Now().UnixMilli()
}

func hashKey(key string) [32]byte {
    return sha256.Sum256([]byte(key))
}

// An answer in JSON, never kept by a cache on the way
func writeJSON(w http.ResponseWriter, status int, v interface{}) {

    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Cache-Control", "no-store")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, why string) {
    writeJSON(w, status, map[string]interface{}{"t": nowMs(), "error": why})
}

// An event as it goes out: the relay's time, when the relay got what it
// carries, and that under its name, the state or a command
func eventOf(kind string, field string, body []byte, at int64) []byte {

    var b strings.Builder

    b.WriteString("event: ")
    b.WriteString(kind)
    b.WriteString("\ndata: {\"t\":")
    b.WriteString(fmt.Sprint(nowMs()))
    b.WriteString(",\"at\":")
    b.WriteString(fmt.Sprint(at))

    if body != nil {
        b.WriteString(",\"")
        b.WriteString(field)
        b.WriteString("\":")
        b.Write(body)
    }

    b.WriteString("}\n\n")

    return []byte(b.String())
}

func event(kind string, state []byte, at int64) []byte {
    return eventOf(kind, "state", state, at)
}

// Hands an event to every one on a stream, dropping it for one too slow
// to take it, as the next state replaces it anyway
func sendTo(set map[chan []byte]struct{}, ev []byte) {

    for ch := range set {

        select {
        case ch <- ev:
        default:
        }
    }
}

func (rm *room) send(ev []byte) {
    sendTo(rm.listeners, ev)
}

// Closes a room: the listeners hear it ended
func (r *relay) close(name string, rm *room) {

    rm.send(event("end", nil, nowMs()))

    for ch := range rm.listeners {
        close(ch)
    }

    for ch := range rm.owners {
        close(ch)
    }

    delete(r.rooms, name)
}

// Rooms nobody posted to for a while are closed
func (r *relay) sweep() {

    for {
        time.Sleep(time.Minute)

        r.mu.Lock()

        for name, rm := range r.rooms {

            if time.Since(rm.postedAt) > roomIdle {
                log.Printf("room %s closed, idle", name)
                r.close(name, rm)
            }
        }

        r.mu.Unlock()
    }
}

func (r *relay) handleTime(w http.ResponseWriter, req *http.Request) {
    writeJSON(w, http.StatusOK, map[string]int64{"t": nowMs()})
}

// The rooms open now, for a player to pick one to listen along with
func (r *relay) handleRooms(w http.ResponseWriter, req *http.Request) {

    type entry struct {
        Room      string `json:"room"`
        Label     string `json:"label"`
        Name      string `json:"name"`
        Title     string `json:"title"`
        Playing   bool   `json:"playing"`
        Listeners int    `json:"listeners"`
    }

    r.mu.Lock()
    list := make([]entry, 0, len(r.rooms))

    for name, rm := range r.rooms {

        if rm.state == nil {
            continue
        }

        list = append(list, entry{Room: name, Label: rm.label, Name: rm.name, Title: rm.title, Playing: rm.playing, Listeners: len(rm.listeners)})
    }

    r.mu.Unlock()

    sort.Slice(list, func(i, j int) bool {
        return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
    })

    writeJSON(w, http.StatusOK, map[string]interface{}{"t": nowMs(), "rooms": list})
}

// /room/<name> takes the sharing player's state (POST) or its leaving
// (DELETE), /room/<name>/events is the stream to listen to,
// /room/<name>/cmd takes a command from one listening along (POST) and
// /room/<name>/cmds is the sharing player's stream of them
func (r *relay) handleRoom(w http.ResponseWriter, req *http.Request) {

    rest := strings.TrimPrefix(req.URL.Path, "/room/")
    name := rest
    part := ""

    if i := strings.IndexByte(rest, '/'); i >= 0 {
        name = rest[:i]
        part = rest[i+1:]
    }

    if !roomName.MatchString(name) {
        fail(w, http.StatusNotFound, "no such room")
        return
    }

    switch part {
    case "events", "cmds":

        if req.Method != http.MethodGet {
            fail(w, http.StatusMethodNotAllowed, "GET only")
            return
        }

        r.listen(w, req, name, part == "cmds")
        return
    case "cmd":

        if req.Method != http.MethodPost {
            fail(w, http.StatusMethodNotAllowed, "POST only")
            return
        }

        r.command(w, req, name)
        return
    case "":
    default:
        fail(w, http.StatusNotFound, "no such room")
        return
    }

    switch req.Method {
    case http.MethodPost:
        r.post(w, req, name)
    case http.MethodDelete:
        r.leave(w, req, name)
    default:
        fail(w, http.StatusMethodNotAllowed, "POST or DELETE")
    }
}

// Whether the key given is the one that opened the room
func keyFits(rm *room, key string) bool {

    h := hashKey(key)

    return subtle.ConstantTimeCompare(h[:], rm.keyHash[:]) == 1
}

func (r *relay) post(w http.ResponseWriter, req *http.Request, name string) {

    key := req.Header.Get("X-Room-Key")

    if len(key) < 16 {
        fail(w, http.StatusUnauthorized, "a room key of 16 characters or more is needed")
        return
    }

    body, err := io.ReadAll(io.LimitReader(req.Body, maxState+1))

    if err != nil || len(body) > maxState {
        fail(w, http.StatusRequestEntityTooLarge, "state too large")
        return
    }

    // The few fields the list of rooms shows, the rest is passed on as it is
    var head struct {
        Name    string `json:"name"`
        Title   string `json:"title"`
        Playing bool   `json:"playing"`
        Room    string `json:"room"`
    }

    if json.Unmarshal(body, &head) != nil {
        fail(w, http.StatusBadRequest, "state is not JSON")
        return
    }

    at := nowMs()

    r.mu.Lock()
    defer r.mu.Unlock()

    rm := r.rooms[name]

    if rm == nil {

        if len(r.rooms) >= maxRooms {
            fail(w, http.StatusServiceUnavailable, "too many rooms")
            return
        }

        rm = &room{keyHash: hashKey(key), listeners: map[chan []byte]struct{}{}, owners: map[chan []byte]struct{}{}}
        r.rooms[name] = rm
        log.Printf("room %s opened", name)
    } else if !keyFits(rm, key) {

        if time.Since(rm.postedAt) < takeoverAfter {
            fail(w, http.StatusForbidden, "the room belongs to another player")
            return
        }

        // The old player's command streams end, the new one reads its own
        rm.keyHash = hashKey(key)

        for ch := range rm.owners {
            close(ch)
            delete(rm.owners, ch)
        }

        log.Printf("room %s taken over by another player", name)
    }

    rm.state = body
    rm.stateAt = at
    rm.postedAt = time.Now()
    rm.name = head.Name
    rm.label = head.Room
    rm.title = head.Title
    rm.playing = head.Playing
    rm.send(event("state", body, at))

    writeJSON(w, http.StatusOK, map[string]interface{}{"t": at, "listeners": len(rm.listeners)})
}

func (r *relay) leave(w http.ResponseWriter, req *http.Request, name string) {

    r.mu.Lock()
    defer r.mu.Unlock()

    rm := r.rooms[name]

    if rm == nil {
        writeJSON(w, http.StatusOK, map[string]int64{"t": nowMs()})
        return
    }

    if !keyFits(rm, req.Header.Get("X-Room-Key")) {
        fail(w, http.StatusForbidden, "the room belongs to another player")
        return
    }

    log.Printf("room %s closed by its player", name)
    r.close(name, rm)
    writeJSON(w, http.StatusOK, map[string]int64{"t": nowMs()})
}

// A command from one listening along, handed to the sharing player's
// stream. Any JSON object, the relay only passes it on
func (r *relay) command(w http.ResponseWriter, req *http.Request, name string) {

    body, err := io.ReadAll(io.LimitReader(req.Body, maxCommand+1))

    if err != nil || len(body) > maxCommand {
        fail(w, http.StatusRequestEntityTooLarge, "command too large")
        return
    }

    var probe map[string]interface{}

    if json.Unmarshal(body, &probe) != nil {
        fail(w, http.StatusBadRequest, "command is not a JSON object")
        return
    }

    at := nowMs()

    r.mu.Lock()
    defer r.mu.Unlock()

    rm := r.rooms[name]

    if rm == nil {
        fail(w, http.StatusNotFound, "no such room")
        return
    }

    second := at / 1000

    if rm.cmdSecond != second {
        rm.cmdSecond = second
        rm.cmdCount = 0
    }

    rm.cmdCount++

    if rm.cmdCount > maxCommandsPerSecond {
        fail(w, http.StatusTooManyRequests, "too many commands")
        return
    }

    if len(rm.owners) == 0 {
        fail(w, http.StatusConflict, "the sharing player is not reachable")
        return
    }

    sendTo(rm.owners, eventOf("cmd", "cmd", body, at))
    writeJSON(w, http.StatusOK, map[string]int64{"t": at})
}

// The stream of a room: the last state at once, then every new one, a
// comment line now and then, and an end event when the room closes. With
// owner, the sharing player's stream of commands, for its key only
func (r *relay) listen(w http.ResponseWriter, req *http.Request, name string, owner bool) {

    flusher, ok := w.(http.Flusher)

    if !ok {
        fail(w, http.StatusInternalServerError, "streaming not possible")
        return
    }

    ch := make(chan []byte, 8)

    r.mu.Lock()
    rm := r.rooms[name]

    if rm == nil {
        r.mu.Unlock()
        fail(w, http.StatusNotFound, "no such room")
        return
    }

    set := rm.listeners

    if owner {

        if !keyFits(rm, req.Header.Get("X-Room-Key")) {
            r.mu.Unlock()
            fail(w, http.StatusForbidden, "the room belongs to another player")
            return
        }

        set = rm.owners
    }

    if len(set) >= maxListeners {
        r.mu.Unlock()
        fail(w, http.StatusServiceUnavailable, "too many listening")
        return
    }

    set[ch] = struct{}{}

    if rm.state != nil && !owner {
        ch <- event("state", rm.state, rm.stateAt)
    }

    r.mu.Unlock()

    defer func() {

        r.mu.Lock()

        if cur := r.rooms[name]; cur == rm {
            delete(set, ch)
        }

        r.mu.Unlock()
    }()

    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-store")
    w.Header().Set("X-Accel-Buffering", "no")
    w.WriteHeader(http.StatusOK)
    _, _ = io.WriteString(w, "retry: 3000\n\n")
    flusher.Flush()

    ping := time.NewTicker(pingEvery)
    defer ping.Stop()

    for {
        select {
        case <-req.Context().Done():
            return
        case ev, open := <-ch:

            if !open {
                return
            }

            if _, err := w.Write(ev); err != nil {
                return
            }

            flusher.Flush()
        case <-ping.C:

            if _, err := fmt.Fprintf(w, ": %d\n\n", nowMs()); err != nil {
                return
            }

            flusher.Flush()
        }
    }
}

// The addresses of a network interface to listen on: its IPv4 ones and
// its global IPv6 ones, not the link local ones
func interfaceAddrs(name string) ([]string, error) {

    ifc, err := net.InterfaceByName(name)

    if err != nil {
        return nil, err
    }

    addrs, err := ifc.Addrs()

    if err != nil {
        return nil, err
    }

    var out []string

    for _, a := range addrs {

        ipn, ok := a.(*net.IPNet)

        if !ok || ipn.IP.IsLinkLocalUnicast() || ipn.IP.IsLinkLocalMulticast() {
            continue
        }

        out = append(out, ipn.IP.String())
    }

    return out, nil
}

// The addresses to listen on: given as one, or those of an interface. An
// interface not up yet, or without an address yet, is waited for, as a
// VPN may come up after the relay
func listenAddrs(listen string, iface string, port int, wait time.Duration) ([]string, error) {

    if iface == "" {
        return []string{listen}, nil
    }

    deadline := time.Now().Add(wait)
    told := false

    for {

        ips, err := interfaceAddrs(iface)

        if err == nil && len(ips) > 0 {

            out := make([]string, 0, len(ips))

            for _, ip := range ips {
                out = append(out, net.JoinHostPort(ip, fmt.Sprint(port)))
            }

            return out, nil
        }

        if time.Now().After(deadline) {

            if err == nil {
                err = fmt.Errorf("interface %s has no address", iface)
            }

            return nil, err
        }

        if !told {
            log.Printf("waiting for interface %s to get an address", iface)
            told = true
        }

        time.Sleep(2 * time.Second)
    }
}

func main() {

    listen := flag.String("listen", "127.0.0.1:8095", "address and port to listen on, the VPN address for players on the VPN")
    iface := flag.String("interface", "", "listen on the addresses of this network interface instead, wg0 for example")
    port := flag.Int("port", 8095, "the port to listen on with -interface")
    wait := flag.Duration("wait", 2*time.Minute, "how long to wait for the interface to get an address")
    flag.Parse()

    addrs, err := listenAddrs(*listen, *iface, *port, *wait)

    if err != nil {
        log.Fatal(err)
    }

    r := &relay{rooms: map[string]*room{}}

    go r.sweep()

    mux := http.NewServeMux()
    mux.HandleFunc("/time", r.handleTime)
    mux.HandleFunc("/rooms", r.handleRooms)
    mux.HandleFunc("/room/", r.handleRoom)

    srv := &http.Server{
        Handler:           mux,
        ReadHeaderTimeout: 10 * time.Second,
        IdleTimeout:       2 * time.Minute,
    }

    // Plain TCP, Multipath TCP turned off: Go turns it on for listeners by
    // default from 1.24, and a VPN interface gains nothing from it
    lc := net.ListenConfig{}
    lc.SetMultipathTCP(false)

    done := make(chan error, len(addrs))

    for _, addr := range addrs {

        ln, err := lc.Listen(context.Background(), "tcp", addr)

        if err != nil {
            log.Fatal(err)
        }

        log.Printf("murekasync listening on %s", addr)

        go func() {
            done <- srv.Serve(ln)
        }()
    }

    log.Fatal(<-done)
}
