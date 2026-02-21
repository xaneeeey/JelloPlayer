from flask import Flask, jsonify, Response, stream_with_context, request
from flask_cors import CORS
from relody_backend import RelodyBackend
import os
import subprocess
from dotenv import load_dotenv


load_dotenv()

app = Flask(__name__)
CORS(app)


API_KEY = os.environ.get("YOUTUBE_API_KEY")

if not API_KEY:
    print("Warning: YOUTUBE_API_KEY not found in environment variables.")


backend = RelodyBackend(API_KEY)


@app.route("/api/channels", methods=["GET"])
def get_channels():
    channels = backend.get_channels()

    channel_list = []

    for name, channel_id in channels.items():
        channel_list.append(
            {
                "id": channel_id,
                "name": name,
                "isHeader": False,
            }
        )

    return jsonify(channel_list)


@app.route("/api/channels/search", methods=["GET"])
def search_channels():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    channels = backend.search_channels(q)
    return jsonify([
        {"id": ch["id"], "name": ch["name"], "thumbnail": ch.get("thumbnail"), "isHeader": False}
        for ch in channels
    ])


@app.route("/api/uploads/<channel_id>", methods=["GET"])
def get_channel_uploads(channel_id):
    songs = backend.get_uploads(channel_id)

    transformed_songs = []
    for song in songs:
        transformed_songs.append(
            {
                "id": song["video_id"],
                "title": song["title"],
                "artist": "Unknown",
                "cover": song["thumbnail"],
                "duration": "0:00",
                "audio": f"http://127.0.0.1:5000/api/stream/{song['video_id']}",
            }
        )

    return jsonify(transformed_songs)


@app.route("/api/search/<channel_id>", methods=["GET"])
def search_channel(channel_id):
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    songs = backend.search_channel_videos(channel_id, q)
    transformed_songs = []
    for song in songs:
        transformed_songs.append(
            {
                "id": song["video_id"],
                "title": song["title"],
                "artist": "Unknown",
                "cover": song["thumbnail"],
                "duration": "0:00",
                "audio": f"http://127.0.0.1:5000/api/stream/{song['video_id']}",
            }
        )
    return jsonify(transformed_songs)


@app.route("/api/trending", methods=["GET"])
def trending_music():
    songs = backend.get_trending_music()
    return jsonify([
        {
            "id": s["video_id"],
            "title": s["title"],
            "cover": s["thumbnail"],
            "duration": "0:00",
            "audio": f"http://127.0.0.1:5000/api/stream/{s['video_id']}",
        }
        for s in songs
    ])


@app.route("/api/recommendations", methods=["GET"])
def recommendations():
    raw = request.args.get("titles", "")
    titles = [t.strip() for t in raw.split("|") if t.strip()]
    if not titles:
        return jsonify([])
    songs = backend.get_recommendations(titles)
    return jsonify([
        {
            "id": s["video_id"],
            "title": s["title"],
            "cover": s["thumbnail"],
            "duration": "0:00",
            "audio": f"http://127.0.0.1:5000/api/stream/{s['video_id']}",
        }
        for s in songs
    ])


@app.route("/api/stream/<video_id>", methods=["GET"])
def stream_audio(video_id):
    def generate():
        process = subprocess.Popen(
        [
            "yt-dlp",
            "-f",
            "bestaudio[ext=m4a]/bestaudio",
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--no-playlist",
            "--quiet",
            "--no-warnings",
            "-o",
            "-",
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
        try:
            while True:
                chunk = process.stdout.read1(1024 * 8)
                if not chunk:
                    break
                yield chunk
        finally:
            process.terminate()

    return Response(
        stream_with_context(generate()),
        mimetype="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


@app.route("/api/download/<video_id>", methods=["GET"])
def download_audio(video_id):
    title = request.args.get("title", video_id)
    safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip() or video_id

    def generate():
        process = subprocess.Popen(
            [
                "yt-dlp",
                "-f",
                "bestaudio[ext=m4a]/bestaudio",
                "--extract-audio",
                "--audio-format",
                "mp3",
                "--no-playlist",
                "--quiet",
                "--no-warnings",
                "-o",
                "-",
                f"https://www.youtube.com/watch?v={video_id}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            while True:
                chunk = process.stdout.read1(1024 * 8)
                if not chunk:
                    break
                yield chunk
        finally:
            process.terminate()

    return Response(
        stream_with_context(generate()),
        mimetype="audio/mpeg",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.mp3"'},
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)