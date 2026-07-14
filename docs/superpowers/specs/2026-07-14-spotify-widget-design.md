# Spotify Now Playing Widget — Design

## Goal

A fixed desktop widget (styled like the iOS/macOS "Now Playing" card) that shows the
current track from the TSUKIBOYS Spotify playlist — cover art, song name, artist —
and plays a 15-second preview via the real Spotify player. Reference visual: Apple
Music lock-screen widget (cover left, title/artist right, progress bar, transport
controls).

Playlist: `https://open.spotify.com/playlist/6JuN8VSuQIBpcRzFZKrK5r` (same one
already linked from the Spotify dock icon and Discord).

## Architecture

### Metadata: serverless endpoint (`api/spotify.js`)

- New Vercel serverless function, same pattern as `api/unlock.js`.
- Uses Spotify's Client Credentials OAuth flow (`SPOTIFY_CLIENT_ID` /
  `SPOTIFY_CLIENT_SECRET` env vars, never exposed client-side).
- Caches the app access token in memory (module-level var + expiry timestamp),
  refreshes when expired — mirrors the in-memory `sessions` pattern already used
  for the trash password unlock.
- `GET /api/spotify` → fetches the playlist's tracks from the Spotify Web API and
  returns a trimmed array:
  ```json
  [{ "name": "...", "artist": "...", "cover": "https://...", "uri": "spotify:track:..." }]
  ```
- Front end fetches this once on page load. Forward/back only change a local array
  index — no repeat network calls.

### Playback: hidden Spotify Embed + IFrame API

- A 1px Spotify Embed iframe (`open.spotify.com/embed/track/...`) is created via
  Spotify's official `IFrameAPI` (`window.onSpotifyIframeApiReady` →
  `createController`). This does the actual audio streaming — no reinventing
  playback.
- Confirmed via Spotify's iframe API docs: `playback_update` events expose
  `playingURI`, `isPaused`, `isBuffering`, `duration`, `position` — **not** track
  name/artist/cover. That's why metadata comes from `api/spotify.js`, not the
  iframe.
- Controller methods used: `play()`, `pause()`, `loadEntity(uri)`, `seek()`.
- 15-second cap: a `playback_update` listener watches `position`; at 15s it calls
  `pause()` and `seek(0)`, resetting state so the next `play()` starts from 0.
- No `next track` method exists on the IFrame API (confirmed in docs), so track
  rotation is done manually: forward/back buttons move a local index into the
  metadata array and call `controller.loadEntity(track.uri)`.

## Visual design

Matches the existing glass aesthetic (`#now-popup` in `styles.css`), scaled up:

- Container: `background: rgba(40,40,40,0.78)`, `backdrop-filter: blur(50px)
  saturate(160%)`, `border: 0.5px solid rgba(255,255,255,0.14)`,
  `border-radius: 10px` (matches `#now-popup` / window containers — not the
  dock's 24px pill), heavy drop shadow.
- Cover art: left-aligned, ~64px square, `border-radius: 6px` (matches other
  thumbnails in the project, e.g. list-view file icons).
- Right column: small Spotify logo top (links out — see Interactions), song name
  (bold, `--label-primary`), artist (`--label-secondary`), mirroring the
  "Steve Jobs / Walter Isaacson" layout in the reference image.
- Progress: thin white pill over a translucent gray track (same treatment as
  `.np-seek`, wider). Time readout shows `0:00 / 0:15` (not full track length) to
  make the preview nature explicit.
- Transport controls: back / play-pause / forward as circular buttons, reusing
  existing icon assets (`play.fill.svg`, `pause.fill.svg`, `forward.fill.svg`, plus
  a new mirrored back icon).
- Placement: fixed position on desktop, chosen to avoid the desktop icon column
  (now on the right, per the last commit) and the dock.

## Interactions

- **Load**: skeleton state (gray cover block, "Cargando…" text) while
  `/api/spotify` is in flight.
- **API failure** (missing creds, Spotify outage, etc.): widget stays hidden
  entirely — no broken card on the desktop. Mirrors how the `#now-playing` menu
  bar icon starts `hidden` until there's something to show.
- **Play/pause**: single tap toggles. Auto-pause + reset to 0 at the 15s mark.
- **Forward/back**: switches track, resets progress to 0. If audio was playing,
  the new track autoplays; if paused, only the card updates (no sound).
- **Spotify logo click**: opens the full playlist in a new tab (same behavior as
  the existing Spotify dock icon) without interrupting playback.

## Setup required (one-time, human)

1. Create an app at the Spotify Developer Dashboard, get Client ID + Secret.
2. Add `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` as Vercel environment
   variables for this project, redeploy.

## Out of scope

- Full-track playback (intentionally capped at 15s).
- User-authenticated Spotify login / Web Playback SDK (would require OAuth per
  visitor — not needed for a public preview widget).
- Dragging/repositioning the widget (fixed position, like other desktop chrome).
