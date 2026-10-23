"""Media sources for the content studio: Pexels footage and Piper voiceover.

Both are free. Each degrades gracefully: with no PEXELS_API_KEY the scene uses
the generated background; with no PIPER_MODEL the video is silent.
Standard library only (urllib), so the workflow needs no extra packages beyond
piper-tts itself.
"""
import json
import os
import shutil
import subprocess
import urllib.parse
import urllib.request
import wave

PEXELS_SEARCH = "https://api.pexels.com/videos/search"
TARGET_W, TARGET_H = 1080, 1920


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out or 0)


class MediaKit:
    def __init__(self, work_dir, credits):
        self.work_dir = work_dir
        self.credits = credits  # list collecting footage attribution
        self.pexels_key = os.environ.get("PEXELS_API_KEY", "").strip()
        self.piper_model = os.environ.get("PIPER_MODEL", "").strip()
        self._voice = None
        self._footage_cache = {}
        self._used_ids = set()

    # ---------- voice ----------
    def _load_voice(self):
        if self._voice is None:
            try:
                from piper import PiperVoice  # piper-tts, open source
            except ImportError:
                self._voice = False
            else:
                self._voice = PiperVoice.load(self.piper_model) if os.path.exists(self.piper_model) else False
        return self._voice

    @property
    def voice_available(self):
        return bool(self.piper_model and self._load_voice())

    def speak(self, text, out_path):
        """Synthesize `text` to a WAV file. Returns the path, or None if no voice."""
        if not text or not self.voice_available:
            return None
        voice = self._load_voice()
        with wave.open(out_path, "wb") as wav_file:
            # piper-tts >= 1.3 exposes synthesize_wav; 1.2 used synthesize(text, wav_file).
            if hasattr(voice, "synthesize_wav"):
                voice.synthesize_wav(text, wav_file)
            else:
                voice.synthesize(text, wav_file)
        return out_path if os.path.getsize(out_path) > 1000 else None

    # ---------- footage ----------
    def _search(self, query):
        params = urllib.parse.urlencode({"query": query, "orientation": "portrait", "size": "medium", "per_page": 15})
        request = urllib.request.Request(f"{PEXELS_SEARCH}?{params}", headers={
            "Authorization": self.pexels_key,
            "User-Agent": "gem-content-studio/1.0",
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response).get("videos", [])

    @staticmethod
    def _best_file(video):
        files = [f for f in video.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("height") and f.get("width")]
        portrait = [f for f in files if f["height"] >= f["width"]]
        pool = portrait or files
        # Prefer the smallest file that is still at least 1280 tall; else the largest available.
        tall = sorted([f for f in pool if f["height"] >= 1280], key=lambda f: f["height"])
        return (tall or sorted(pool, key=lambda f: -f["height"]))[0] if pool else None

    def footage(self, query, min_seconds, out_path):
        """Download a portrait clip for `query`. Returns the path, or None."""
        if not query or not self.pexels_key:
            return None
        if query not in self._footage_cache:
            try:
                self._footage_cache[query] = self._search(query)
            except Exception as error:  # network or API failure: fall back to generated background
                print(f"[footage] search failed for {query!r}: {error}")
                self._footage_cache[query] = []
        candidates = [v for v in self._footage_cache[query] if v.get("id") not in self._used_ids]
        candidates.sort(key=lambda v: (v.get("duration", 0) < min_seconds, -v.get("duration", 0) if v.get("duration", 0) < min_seconds else 0))
        for video in candidates:
            chosen = self._best_file(video)
            if not chosen:
                continue
            try:
                request = urllib.request.Request(chosen["link"], headers={"User-Agent": "gem-content-studio/1.0"})
                with urllib.request.urlopen(request, timeout=120) as response, open(out_path, "wb") as handle:
                    shutil.copyfileobj(response, handle)
            except Exception as error:
                print(f"[footage] download failed for {video.get('id')}: {error}")
                continue
            self._used_ids.add(video.get("id"))
            self.credits.append({
                "query": query,
                "pexels_id": video.get("id"),
                "url": video.get("url"),
                "videographer": (video.get("user") or {}).get("name"),
                "videographer_url": (video.get("user") or {}).get("url"),
            })
            return out_path
        return None


class FrameReader:
    """Streams a clip as 1080x1920 RGB frames at `fps`, looping if it is short."""

    def __init__(self, path, seconds, fps):
        vf = (f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=increase,"
              f"crop={TARGET_W}:{TARGET_H},fps={fps}")
        self.frame_bytes = TARGET_W * TARGET_H * 3
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-stream_loop", "-1", "-i", path, "-t", f"{seconds:.3f}",
             "-vf", vf, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE,
        )
        self.last = None

    def next(self):
        data = self.proc.stdout.read(self.frame_bytes)
        if len(data) == self.frame_bytes:
            self.last = data
        return self.last

    def close(self):
        if self.proc.stdout:
            self.proc.stdout.close()
        self.proc.wait()
