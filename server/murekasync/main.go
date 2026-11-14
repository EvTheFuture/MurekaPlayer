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
// to it: the song, where it is and whether it plays. Players listening
// along read the room as a stream of events. Nothing connects to the
// sharing player, and the relay keeps nothing on disk. Every answer
// carries the relay's own time in milliseconds, which the players use as
// their common clock
package main

import (
    "crypto/sha256"
    "crypto/subtle"
    "encoding/json"
    "flag"
    "fmt"
    "io"
    "log"
    "net/http"
    "regexp"
    "sort"
    "strings"
    "sync"
    "time"
)

const (
    // The largest state a sharing player may post
    maxState = 64 * 1024

    // Rooms and listeners at most, so a mistake cannot eat the server
    maxRooms     = 64
    maxListeners = 32

    // A room nobody posted to for this long is closed
    roomIdle = 10 * time.Minute

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
    title     string
    playing   bool
    listeners map[chan []byte]struct{}
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

// An event as it goes to the listeners: the relay's time and the state
func event(kind string, state []byte, at int64) []byte {

    var b strings.Builder

    b.WriteString("event: ")
    b.WriteString(kind)
    b.WriteString("\ndata: {\"t\":")
    b.WriteString(fmt.Sprint(nowMs()))
    b.WriteString(",\"at\":")
    b.WriteString(fmt.Sprint(at))

    if state != nil {
        b.WriteString(",\"state\":")
        b.Write(state)
    }

    b.WriteString("}\n\n")

    return []byte(b.String())
}

// Hands an event to every listener, dropping it for one too slow to take
// it, as the next state replaces it anyway
func (rm *room) send(ev []byte) {

    for ch := range rm.listeners {

        select {
        case ch <- ev:
        default:
        }
    }
}

// Closes a room: the listeners hear it ended
func (r *relay) close(name string, rm *room) {

    rm.send(event("end", nil, nowMs()))

    for ch := range rm.listeners {
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

        list = append(list, entry{Room: name, Name: rm.name, Title: rm.title, Playing: rm.playing, Listeners: len(rm.listeners)})
    }

    r.mu.Unlock()

    sort.Slice(list, func(i, j int) bool {
        return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
    })

    writeJSON(w, http.StatusOK, map[string]interface{}{"t": nowMs(), "rooms": list})
}

// /room/<name> takes the sharing player's state (POST) or its leaving
// (DELETE), and /room/<name>/events is the stream to listen to
func (r *relay) handleRoom(w http.ResponseWriter, req *http.Request) {

    rest := strings.TrimPrefix(req.URL.Path, "/room/")
    name := strings.TrimSuffix(rest, "/events")
    events := name != rest

    if !roomName.MatchString(name) {
        fail(w, http.StatusNotFound, "no such room")
        return
    }

    if events {

        if req.Method != http.MethodGet {
            fail(w, http.StatusMethodNotAllowed, "GET only")
            return
        }

        r.listen(w, req, name)
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

        rm = &room{keyHash: hashKey(key), listeners: map[chan []byte]struct{}{}}
        r.rooms[name] = rm
        log.Printf("room %s opened", name)
    } else if !keyFits(rm, key) {
        fail(w, http.StatusForbidden, "the room belongs to another player")
        return
    }

    rm.state = body
    rm.stateAt = at
    rm.postedAt = time.Now()
    rm.name = head.Name
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

// The stream of a room: the last state at once, then every new one, a
// comment line now and then, and an end event when the room closes
func (r *relay) listen(w http.ResponseWriter, req *http.Request, name string) {

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

    if len(rm.listeners) >= maxListeners {
        r.mu.Unlock()
        fail(w, http.StatusServiceUnavailable, "too many listening")
        return
    }

    rm.listeners[ch] = struct{}{}

    if rm.state != nil {
        ch <- event("state", rm.state, rm.stateAt)
    }

    r.mu.Unlock()

    defer func() {

        r.mu.Lock()

        if cur := r.rooms[name]; cur == rm {
            delete(rm.listeners, ch)
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

func main() {

    listen := flag.String("listen", "127.0.0.1:8095", "address and port to listen on, the VPN address for players on the VPN")
    flag.Parse()

    r := &relay{rooms: map[string]*room{}}

    go r.sweep()

    mux := http.NewServeMux()
    mux.HandleFunc("/time", r.handleTime)
    mux.HandleFunc("/rooms", r.handleRooms)
    mux.HandleFunc("/room/", r.handleRoom)

    srv := &http.Server{
        Addr:              *listen,
        Handler:           mux,
        ReadHeaderTimeout: 10 * time.Second,
        IdleTimeout:       2 * time.Minute,
    }

    log.Printf("murekasync listening on %s", *listen)
    log.Fatal(srv.ListenAndServe())
}
