import re
import requests


class RelodyBackend:
    CHANNELS = {
        "Trap Nation": "UCa10nxShhzNrCE1o2ZOPztg",
        "Electro Posé": "UCpO0OSNAFLRUpGrNz-bJJHA",
        "Chill Nation": "UCM9KEEuzacwVlkt9JfJad7g",
        "NCS": "UC_aEa8K-EOJ3D6gOs7HcyNg",
        "MrSuicideSheep": "UC5nc_ZtjKW1htCVZVRxlQAQ",
        "Trap City": "UC65afEgL62PGFWXY7n6CUbA",
        "CloudKid": "UCSa8IUd1uEjlREMa21I3ZPQ",
    }

    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://www.googleapis.com/youtube/v3"

    def get_channels(self):
        """Returns the dictionary of channels."""
        return self.CHANNELS

    def _parse_duration_seconds(self, duration):
        """Convert ISO 8601 duration (e.g. PT1M30S) to total seconds."""
        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration or '')
        if not match:
            return 0
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        return hours * 3600 + minutes * 60 + seconds

    def _filter_shorts(self, songs):
        """Remove YouTube Shorts from a list of song dicts.

        Detection uses two signals:
        - Duration <= 60 s (original Shorts limit; YouTube extended to 3 min in 2024
          but tagged Shorts catch the rest)
        - #shorts / #short hashtag in title, first 300 chars of description, or tags
        """
        video_ids = [s["video_id"] for s in songs if s.get("video_id")]
        if not video_ids:
            return songs
        url = f"{self.base_url}/videos"
        params = {
            "id": ",".join(video_ids),
            "part": "contentDetails,snippet",
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            long_form = set()
            for item in response.json().get("items", []):
                vid_id = item["id"]
                duration = self._parse_duration_seconds(
                    item.get("contentDetails", {}).get("duration", "PT0S")
                )
                snippet = item.get("snippet", {})
                title = snippet.get("title", "").lower()
                desc = snippet.get("description", "")[:300].lower()
                tags = [t.lower() for t in snippet.get("tags", [])]
                is_short = (
                    duration <= 60
                    or "#shorts" in title
                    or "#short" in title
                    or "#shorts" in desc
                    or "shorts" in tags
                )
                if not is_short:
                    long_form.add(vid_id)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching video info: {e}")
            return songs
        return [s for s in songs if s.get("video_id") in long_form]

    def _parse_search_items(self, items):
        """Parse YouTube search API items into song dicts."""
        songs = []
        for item in items:
            snippet = item.get("snippet", {})
            video_id = item.get("id", {}).get("videoId")
            title = snippet.get("title", "")
            if title in ("Private video", "Deleted video") or not video_id:
                continue
            thumbnails = snippet.get("thumbnails", {})
            thumb = (
                thumbnails.get("maxres")
                or thumbnails.get("standard")
                or thumbnails.get("high")
                or {}
            ).get("url")
            songs.append({"title": title, "thumbnail": thumb, "video_id": video_id})
        return songs

    def get_channel_uploads_id(self, channel_id):
        """Fetches the Uploads Playlist ID for a given Channel ID."""
        url = f"{self.base_url}/channels"
        params = {"id": channel_id, "part": "contentDetails", "key": self.api_key}
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if "items" in data and len(data["items"]) > 0:
                return data["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
            return None
        except requests.exceptions.RequestException as e:
            print(f"Error fetching channel details: {e}")
            return None

    def get_uploads(self, channel_id, target=50):
        """Paginates through the uploads playlist until `target` long-form videos
        are collected or all pages are exhausted (max 10 pages = 500 items scanned)."""
        uploads_id = self.get_channel_uploads_id(channel_id)
        if not uploads_id:
            return []

        long_form = []
        page_token = None

        for _ in range(10):  # scan at most 500 uploads
            params = {
                "playlistId": uploads_id,
                "part": "snippet,contentDetails",
                "maxResults": 50,
                "key": self.api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            try:
                response = requests.get(f"{self.base_url}/playlistItems", params=params)
                response.raise_for_status()
                data = response.json()
            except requests.exceptions.RequestException as e:
                print(f"Error fetching uploads: {e}")
                break

            songs = []
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                content_details = item.get("contentDetails", {})
                title = snippet.get("title", "")
                if title in ("Private video", "Deleted video"):
                    continue
                thumbnails = snippet.get("thumbnails", {})
                thumb = (
                    thumbnails.get("maxres")
                    or thumbnails.get("standard")
                    or thumbnails.get("high")
                    or {}
                ).get("url")
                songs.append({
                    "title": title,
                    "thumbnail": thumb,
                    "video_id": content_details.get("videoId"),
                })

            long_form.extend(self._filter_shorts(songs))

            if len(long_form) >= target:
                break

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return long_form[:target]

    def search_channel_videos(self, channel_id, query):
        """Searches all videos in a channel by query string."""
        url = f"{self.base_url}/search"
        params = {
            "channelId": channel_id,
            "part": "snippet",
            "type": "video",
            "q": query,
            "order": "relevance",
            "maxResults": 50,
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            songs = self._parse_search_items(response.json().get("items", []))
            return self._filter_shorts(songs)
        except requests.exceptions.RequestException as e:
            print(f"Error searching channel videos: {e}")
            return []

    def search_channels(self, query):
        """Searches YouTube for channels matching the query, returning only verified ones."""
        url = f"{self.base_url}/search"
        params = {
            "part": "snippet",
            "type": "channel",
            "q": query,
            "maxResults": 25,
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            channels = []
            for item in response.json().get("items", []):
                snippet = item.get("snippet", {})
                channel_id = item.get("id", {}).get("channelId")
                name = snippet.get("title", "")
                thumbnails = snippet.get("thumbnails", {})
                thumb = (
                    thumbnails.get("high")
                    or thumbnails.get("medium")
                    or thumbnails.get("default")
                    or {}
                ).get("url")
                if channel_id and name:
                    channels.append({"id": channel_id, "name": name, "thumbnail": thumb})

            return self._filter_verified_channels(channels)
        except requests.exceptions.RequestException as e:
            print(f"Error searching channels: {e}")
            return []

    def _filter_verified_channels(self, channels):
        """Keep only channels with 100k+ subscribers (proxy for verified status)."""
        if not channels:
            return channels
        channel_ids = [ch["id"] for ch in channels]
        url = f"{self.base_url}/channels"
        params = {
            "id": ",".join(channel_ids),
            "part": "statistics",
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            stats = {}
            for item in response.json().get("items", []):
                s = item.get("statistics", {})
                hidden = s.get("hiddenSubscriberCount", False)
                count = int(s.get("subscriberCount", 0)) if not hidden else 0
                stats[item["id"]] = count
        except requests.exceptions.RequestException as e:
            print(f"Error fetching channel statistics: {e}")
            return channels
        return [ch for ch in channels if stats.get(ch["id"], 0) >= 100_000]

    def _search_videos(self, query, max_results=10):
        """Search YouTube for music videos matching query."""
        url = f"{self.base_url}/search"
        params = {
            "part": "snippet",
            "type": "video",
            "videoCategoryId": "10",
            "q": query,
            "maxResults": max_results,
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return self._parse_search_items(response.json().get("items", []))
        except requests.exceptions.RequestException as e:
            print(f"Error searching videos: {e}")
            return []

    def get_trending_music(self, max_results=50):
        """Fetch YouTube trending music videos."""
        url = f"{self.base_url}/videos"
        params = {
            "chart": "mostPopular",
            "videoCategoryId": "10",
            "part": "snippet,contentDetails",
            "maxResults": max_results,
            "regionCode": "US",
            "key": self.api_key,
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            songs = []
            for item in response.json().get("items", []):
                snippet = item.get("snippet", {})
                video_id = item.get("id")
                title = snippet.get("title", "")
                if title in ("Private video", "Deleted video") or not video_id:
                    continue
                thumbnails = snippet.get("thumbnails", {})
                thumb = (
                    thumbnails.get("maxres")
                    or thumbnails.get("standard")
                    or thumbnails.get("high")
                    or {}
                ).get("url")
                songs.append({"title": title, "thumbnail": thumb, "video_id": video_id})
            return self._filter_shorts(songs)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching trending music: {e}")
            return []

    def get_recommendations(self, titles, per_title=10):
        """Return music recommendations by searching YouTube for each song title."""
        results = []
        seen = set()
        for title in titles[:5]:
            for song in self._search_videos(title, per_title):
                vid = song.get("video_id")
                if vid and vid not in seen:
                    seen.add(vid)
                    results.append(song)
        return self._filter_shorts(results)

    def get_video_url(self, video_id):
        return f"https://www.youtube.com/watch?v={video_id}"
