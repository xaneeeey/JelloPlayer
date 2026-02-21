# Relody

A music streaming web app that streams audio from YouTube channels directly in your browser. Browse channels, discover trending music, build playlists, and listen — no accounts, no ads, just audio.

![Static Badge](https://img.shields.io/badge/React-19-blue?logo=react)
![Static Badge](https://img.shields.io/badge/Flask-Python-green?logo=python)
![Static Badge](https://img.shields.io/badge/yt--dlp-audio-red)
![Static Badge](https://img.shields.io/badge/YouTube%20Data%20API-v3-yellow?logo=youtube)

---

## Features

- **Channel discovery** — 7 curated channels by default; search YouTube for any channel (filtered to verified channels with 100k+ subscribers)
- **Favorite channels** — Star channels to save them to your sidebar; persisted across sessions
- **Music browsing** — Responsive card grid with hover overlays for quick actions
- **Real-time audio streaming** — yt-dlp extracts audio on demand; no caching, no stored files
- **Song search** — Debounced server-side search within any selected channel
- **Queue system** — Add songs to a queue, shuffle it (Fisher-Yates), remove individual tracks, and navigate it independently of the channel
- **Local playlists** — Create named playlists, drag songs into them, and load them into the queue; persisted to `localStorage`
- **Download** — Save any song as an MP3 directly from the app
- **Home screen** — Trending music if you have no playlists; personalized recommendations based on your playlist songs if you do
- **Audio-reactive visualizer** — Background gradient animations driven by real-time bass frequency data; colors sampled from the current song's album art
- **YouTube Shorts filtering** — Backend automatically excludes Shorts from all results (duration, title, tags detection)
- **Chess easter egg** — A hidden chess game with Stockfish AI at three difficulty levels

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Axios |
| Backend | Python Flask, Flask-CORS |
| Audio extraction | yt-dlp (subprocess) |
| Data source | YouTube Data API v3 |
| Styling | Plain CSS, glassmorphism dark theme |
| Persistence | Browser `localStorage` |
| Easter egg | chess.js, react-chessboard, Stockfish 18 |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **yt-dlp** — must be installed and available in your `PATH`
- A **YouTube Data API v3** key ([get one here](https://console.developers.google.com/))

Install yt-dlp:

```bash
pip install yt-dlp
# or
brew install yt-dlp
```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Relody.git
cd Relody
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
pip install flask flask-cors requests python-dotenv
```

### 4. Add your YouTube API key

Create `Python Backend/.env`:

```env
YOUTUBE_API_KEY=your_api_key_here
```

### 5. Start both servers

```bash
./start.sh
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## API Reference

All routes are served from `http://127.0.0.1:5000/api`.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/channels` | Returns the 7 hardcoded default channels |
| `GET` | `/channels/search?q=<query>` | YouTube-wide channel search (100k+ subscribers filter) |
| `GET` | `/uploads/<channel_id>` | Latest 50 non-Short videos from a channel |
| `GET` | `/search/<channel_id>?q=<query>` | Search within a channel by keyword |
| `GET` | `/stream/<video_id>` | Stream audio in real time via yt-dlp (MP3) |
| `GET` | `/download/<video_id>?title=<title>` | Download audio as an MP3 file |
| `GET` | `/trending` | Trending YouTube Music videos (US, category 10) |
| `GET` | `/recommendations?titles=<pipe\|separated>` | Recommendations based on song titles |

### Streaming pipeline

1. Browser requests `/api/stream/<video_id>`
2. Flask spawns a `yt-dlp` subprocess to extract the best audio format
3. Audio is converted to MP3 on the fly and streamed back in 8 KB chunks
4. The HTML `<audio>` element plays the stream; the Web Audio API reads it for visualization

No audio files are stored on disk.

---

## How It Works

### Audio visualization

`App.jsx` connects the `<audio>` element to the Web Audio API:

- An `AnalyserNode` with FFT size 256 samples frequency data 60 times per second
- The first 10 frequency bins represent bass energy
- Four radial gradient blobs animate position and scale driven by this energy
- The color palette is extracted from the current song's thumbnail by drawing it to a hidden `<canvas>` (60×60 px) and sampling pixel data

### Shorts filtering

The backend detects YouTube Shorts before returning results:

- **Duration** ≤ 60 seconds (fetched from YouTube `/videos` endpoint)
- **Title or description** contains `#shorts` or `#short`
- **Tags** contain `shorts`

Any video matching these criteria is removed from all results — uploads, searches, trending, and recommendations.

### Queue vs. channel playback

`App.jsx` tracks a `playSource` flag (`'channel'` or `'queue'`). When the queue is active, next/previous navigate through the queue array independently of the channel song list. Switching back to a channel song resets the source.

### Playlists and favorites

Both are serialized to `localStorage`:

- `relody-playlists` — array of `{ id, name, songs[] }` objects
- `relody-favourites` — array of channel objects

Songs are added to playlists by dragging a card from the grid and dropping it on a playlist item in the sidebar.

---

## Default Channels

| Channel | YouTube Channel ID |
|---------|-------------------|
| Trap Nation | `UCa10nxShhzNrCE1o2ZOPztg` |
| Electro Posé | `UCpO0OSNAFLRUpGrNz-bJJHA` |
| Chill Nation | `UCM9KEEuzacwVlkt9JfJad7g` |
| NCS | `UC_aEa8K-EOJ3D6gOs7HcyNg` |
| MrSuicideSheep | `UC5nc_ZtjKW1htCVZVRxlQAQ` |
| Trap City | `UC65afEgL62PGFWXY7n6CUbA` |
| CloudKid | `UCSa8IUd1uEjlREMa21I3ZPQ` |

---

## Known Limitations

- **No audio caching** — every play triggers a fresh yt-dlp extraction; initial buffering may take a few seconds depending on your connection and yt-dlp speed
- **Song metadata** — `artist` is always `"Unknown"` and `duration` is always `"0:00"` because these fields are not fetched from the YouTube API
- **YouTube API quota** — the Data API v3 has a daily quota of 10,000 units; heavy use of channel search and uploads can exhaust it
- **Local only** — playlists and favorites are stored in the browser's `localStorage` and are not synced across devices
- **yt-dlp dependency** — audio availability depends on yt-dlp's ability to extract audio, which can break when YouTube changes its internals (update yt-dlp regularly: `yt-dlp -U`)

---

## Development Notes

- All React state lives in `App.jsx` using built-in hooks — no Redux, Zustand, or Context API
- Props are passed down directly to children (intentional; avoids over-engineering for this scope)
- 500 ms debounce on all search inputs to stay within API rate limits
- `audioRef` and several playback refs are kept in sync with state to avoid stale closure bugs in audio event handlers
- The chess easter egg (`ChessEasterEgg.jsx`) runs Stockfish in a Web Worker to avoid blocking the UI thread; it is not wired into the main app UI

---

## License

MIT
