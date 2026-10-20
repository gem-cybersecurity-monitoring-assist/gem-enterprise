#!/usr/bin/env python3
"""Render a GEM video storyline into platform-ready MP4s.

Pipeline: storyline JSON -> Pexels clips (API) -> per-beat voiceover (Kokoro,
Apache-2.0) -> 9:16 master with burned captions and GEM branding -> 4:5 and
16:9 variants -> ffprobe validation -> manifest.json.

Usage:
  python3 -I scripts/video-storylines/render.py --storyline <id> --out <dir>
  python3 -I scripts/video-storylines/render.py --rotate --out <dir>
  python3 -I scripts/video-storylines/render.py --storyline <id> --offline --out <dir>

--offline replaces Pexels and TTS with generated test footage and tone audio,
so the ffmpeg graph, captions, variants and validation can be exercised with
no network or secrets. Offline output is never publishable (manifest marks it).

Secrets: PEXELS_API_KEY (env). Never printed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / "content" / "video-storylines" / "gem-storylines.v1.json"

W, H, FPS = 1080, 1920, 30
END_CARD_SEC = 2.0
VO_TAIL_SEC = 0.35
WORDS_PER_SEC_OFFLINE = 2.6
SAMPLE_RATE = 48_000

# Conservative publishing bounds shared by every target API for this content
# class (short-form, under one minute). Platform maxima are higher; we validate
# against the strictest common envelope so one render fits every destination.
MAX_DURATION_SEC = 60.0
MAX_BYTES = 512 * 1024 * 1024

VARIANTS = {
    "vertical_9x16": {"w": 1080, "h": 1920, "platforms": ["TIKTOK", "INSTAGRAM_REELS", "FACEBOOK_REELS", "YOUTUBE_SHORTS", "TELEGRAM"]},
    "feed_4x5": {"w": 1080, "h": 1350, "platforms": ["INSTAGRAM_FEED", "FACEBOOK_FEED"]},
    "landscape_16x9": {"w": 1920, "h": 1080, "platforms": ["X", "LINKEDIN", "YOUTUBE"]},
}

# Caption safe zone: stays inside the 4:5 centre crop (y 285..1635) and above
# the TikTok/Reels bottom UI band.
HEADLINE_Y = 430
SUBTITLE_Y = 1390

ACCENT_ASS = "&H00A0C900"  # #00c9a0 in ASS BGR order
WHITE_ASS = "&H00FFFFFF"
PANEL_ASS = "&H66120F0B"   # translucent #0b0f12


def log(msg: str) -> None:
    print(f"[render] {msg}", flush=True)


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-25:])
        raise RuntimeError(f"command failed ({cmd[0]}):\n{tail}")


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def duration_of(path: Path) -> float:
    return float(probe(path)["format"]["duration"])


def span_seconds(span: str) -> float:
    a, b = (float(x) for x in span.split("-"))
    return max(b - a, 1.0)


# --------------------------------------------------------------------------- Pexels

class Pexels:
    BASE = "https://api.pexels.com"

    def __init__(self, key: str) -> None:
        self.key = key

    def _get(self, path: str, params: dict | None = None) -> dict:
        url = f"{self.BASE}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"Authorization": self.key, "User-Agent": "gem-video-storylines/1"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())

    def video(self, video_id: int) -> dict:
        return self._get(f"/videos/videos/{video_id}")

    def search_portrait(self, query: str, exclude: set[int], limit: int = 5) -> list[dict]:
        data = self._get("/videos/search", {"query": query, "orientation": "portrait", "size": "medium", "per_page": 15})
        return [v for v in data.get("videos", []) if v["id"] not in exclude][:limit]

    @staticmethod
    def best_file(video: dict) -> dict:
        files = [f for f in video.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("width") and f.get("height")]
        portrait = [f for f in files if f["height"] >= f["width"]] or files
        # Prefer the smallest file that still covers 1080x1920; else the largest available.
        covering = [f for f in portrait if f["width"] >= W and f["height"] >= H]
        pool = covering or portrait
        key = (lambda f: f["width"] * f["height"]) if covering else (lambda f: -f["width"] * f["height"])
        return sorted(pool, key=key)[0]

    @staticmethod
    def download(url: str, dest: Path) -> None:
        req = urllib.request.Request(url, headers={"User-Agent": "gem-video-storylines/1"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as fh:
            shutil.copyfileobj(resp, fh)


# --------------------------------------------------------------------------- Voice

class Voice:
    def __init__(self, offline: bool, voice: str) -> None:
        self.offline = offline
        self.voice = voice
        self.pipeline = None
        if not offline:
            from kokoro import KPipeline  # Apache-2.0, CPU inference
            self.pipeline = KPipeline(lang_code="a")

    def synth(self, text: str, dest: Path) -> float:
        if self.offline:
            words = len(text.split())
            secs = max(words / WORDS_PER_SEC_OFFLINE, 1.0)
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=220:sample_rate={SAMPLE_RATE}:duration={secs:.2f}",
                 "-af", "volume=0.05", "-ac", "1", str(dest)])
            return secs
        import numpy as np
        import soundfile as sf
        chunks = [audio for _, _, audio in self.pipeline(text, voice=self.voice)]
        audio = np.concatenate([np.asarray(c, dtype="float32") for c in chunks])
        tmp = dest.with_suffix(".24k.wav")
        sf.write(tmp, audio, 24_000)
        run(["ffmpeg", "-y", "-i", str(tmp), "-ar", str(SAMPLE_RATE), "-ac", "1", str(dest)])
        return duration_of(dest)


# --------------------------------------------------------------------------- Captions (ASS)

def ass_time(t: float) -> str:
    t = max(t, 0.0)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ass_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def word_chunks(text: str, start: float, dur: float, size: int = 3) -> list[tuple[float, float, str]]:
    words = text.replace("“", "").replace("”", "").split()
    chunks = [" ".join(words[i:i + size]) for i in range(0, len(words), size)]
    weights = [max(len(c), 1) for c in chunks]
    total = sum(weights)
    out, t = [], start
    for c, w in zip(chunks, weights):
        d = dur * w / total
        out.append((t, t + d, c))
        t += d
    return out


def build_ass(beats: list["Beat"], total: float, cta_line: str, url_line: str) -> str:
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Headline,Inter,74,{WHITE_ASS},{WHITE_ASS},{PANEL_ASS},{PANEL_ASS},-1,0,0,0,100,100,0,0,3,18,0,8,90,90,{HEADLINE_Y},1
Style: Sub,Inter,62,{WHITE_ASS},{WHITE_ASS},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,{H - SUBTITLE_Y},1
Style: Bug,Inter,34,{ACCENT_ASS},{ACCENT_ASS},&H00000000,&H00000000,-1,0,0,0,100,100,4,0,1,2,0,9,60,60,320,1
Style: EndTitle,Inter,78,{WHITE_ASS},{WHITE_ASS},&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,90,90,0,1
Style: EndUrl,Inter,48,{ACCENT_ASS},{ACCENT_ASS},&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,5,90,90,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    content_end = total - END_CARD_SEC
    lines.append(f"Dialogue: 2,{ass_time(0)},{ass_time(content_end)},Bug,,0,0,0,,GEM ENTERPRISE")
    for b in beats:
        lines.append(f"Dialogue: 1,{ass_time(b.start)},{ass_time(b.end)},Headline,,0,0,0,,{{\\fad(120,80)}}{ass_escape(b.caption)}")
        for s, e, text in word_chunks(b.voiceover, b.start, b.vo_seconds):
            lines.append(f"Dialogue: 1,{ass_time(s)},{ass_time(e)},Sub,,0,0,0,,{ass_escape(text)}")
    lines.append(f"Dialogue: 1,{ass_time(content_end)},{ass_time(total)},EndTitle,,0,0,0,,{{\\pos({W // 2},{H // 2 - 60})\\fad(150,0)}}{ass_escape(cta_line)}")
    lines.append(f"Dialogue: 1,{ass_time(content_end)},{ass_time(total)},EndUrl,,0,0,0,,{{\\pos({W // 2},{H // 2 + 60})\\fad(150,0)}}{ass_escape(url_line)}")
    return header + "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- Timeline

@dataclass
class Beat:
    index: int
    role: str
    caption: str
    voiceover: str
    clip: dict
    planned: float
    vo_path: Path | None = None
    vo_seconds: float = 0.0
    start: float = 0.0
    end: float = 0.0
    segments: list[Path] = field(default_factory=list)
    credits: list[dict] = field(default_factory=list)

    @property
    def seconds(self) -> float:
        return self.end - self.start


def cover_filter() -> str:
    return (f"scale='if(gt(a,{W}/{H}),-2,{W})':'if(gt(a,{W}/{H}),{H},-2)',"
            f"crop={W}:{H},fps={FPS},setsar=1,format=yuv420p")


def offline_clip(dest: Path, seconds: float, index: int) -> None:
    hue = (index * 47) % 360
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"testsrc2=size=720x1280:rate={FPS}:duration={seconds + 1:.2f}",
         "-vf", f"hue=h={hue}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dest)])


def fetch_clips(beats: list[Beat], work: Path, pexels: Pexels | None, theme: str) -> None:
    used: set[int] = {b.clip["id"] for b in beats}
    for b in beats:
        need = b.seconds
        primary = work / f"beat{b.index:02d}_a.mp4"
        if pexels is None:
            offline_clip(primary, need, b.index)
            b.segments.append(primary)
            b.credits.append({"source": "offline-test", "id": b.clip["id"], "url": b.clip["url"]})
            continue
        video = pexels.video(b.clip["id"])
        Pexels.download(Pexels.best_file(video)["link"], primary)
        b.segments.append(primary)
        b.credits.append({"source": "pexels", "id": video["id"], "url": video["url"], "creator": video.get("user", {}).get("name")})
        have = duration_of(primary)
        # Rule: never loop or slow footage. Extend with a second on-theme clip.
        while have + 0.05 < need:
            candidates = pexels.search_portrait(f"{theme} {b.role}".strip(), used)
            if not candidates:
                candidates = pexels.search_portrait(theme, used)
            if not candidates:
                raise RuntimeError(f"beat {b.index}: no extension clip found for '{theme}'")
            extra = candidates[0]
            used.add(extra["id"])
            path = work / f"beat{b.index:02d}_{len(b.segments)}.mp4"
            Pexels.download(Pexels.best_file(extra)["link"], path)
            b.segments.append(path)
            b.credits.append({"source": "pexels", "id": extra["id"], "url": extra["url"], "creator": extra.get("user", {}).get("name")})
            have += duration_of(path)


def render_beat_video(b: Beat, work: Path) -> Path:
    out = work / f"beat{b.index:02d}.mp4"
    inputs: list[str] = []
    parts = []
    for i, seg in enumerate(b.segments):
        inputs += ["-i", str(seg)]
        parts.append(f"[{i}:v]{cover_filter()}[s{i}]")
    concat = "".join(f"[s{i}]" for i in range(len(b.segments)))
    graph = ";".join(parts) + f";{concat}concat=n={len(b.segments)}:v=1:a=0,trim=duration={b.seconds:.3f},setpts=PTS-STARTPTS[v]"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", graph, "-map", "[v]", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(FPS), str(out)])
    return out


def render_master(beats: list[Beat], work: Path, ass_path: Path, out: Path) -> float:
    beat_videos = [render_beat_video(b, work) for b in beats]
    end_card = work / "endcard.mp4"
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=0x0b0f12:size={W}x{H}:rate={FPS}:duration={END_CARD_SEC}",
         "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(end_card)])
    concat_list = work / "concat.txt"
    concat_list.write_text("".join(f"file '{p.as_posix()}'\n" for p in [*beat_videos, end_card]))
    joined = work / "joined.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(joined)])

    # Voiceover track: each beat's VO padded to the beat length, then end-card silence.
    audio_inputs: list[str] = []
    pads = []
    for i, b in enumerate(beats):
        audio_inputs += ["-i", str(b.vo_path)]
        pads.append(f"[{i}:a]aresample={SAMPLE_RATE},apad=whole_dur={b.seconds:.3f},atrim=duration={b.seconds:.3f}[a{i}]")
    n = len(beats)
    tail = f"anullsrc=r={SAMPLE_RATE}:cl=mono,atrim=duration={END_CARD_SEC}[tail]"
    graph = ";".join(pads) + f";{tail};" + "".join(f"[a{i}]" for i in range(n)) + f"[tail]concat=n={n + 1}:v=0:a=1,loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
    voice = work / "voice.wav"
    run(["ffmpeg", "-y", *audio_inputs, "-filter_complex", graph, "-map", "[aout]", "-ar", str(SAMPLE_RATE), "-ac", "2", str(voice)])

    fontsdir = "/usr/share/fonts"
    ass_arg = f"ass={ass_path.as_posix()}:fontsdir={fontsdir}"
    run(["ffmpeg", "-y", "-i", str(joined), "-i", str(voice), "-vf", ass_arg,
         "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20",
         "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2),
         "-c:a", "aac", "-b:a", "192k", "-ar", str(SAMPLE_RATE), "-ac", "2", "-shortest", "-movflags", "+faststart", str(out)])
    return duration_of(out)


def render_variant(master: Path, name: str, out: Path) -> None:
    if name == "feed_4x5":
        vf = "crop=1080:1350:0:(ih-1350)/2,setsar=1"
    elif name == "landscape_16x9":
        vf = None
        graph = ("[0:v]split=2[bg][fg];"
                 "[bg]scale=1920:-2,crop=1920:1080,boxblur=24:2,eq=brightness=-0.12[b];"
                 "[fg]scale=-2:1080[f];[b][f]overlay=(W-w)/2:0,setsar=1,format=yuv420p[v]")
    else:
        raise ValueError(name)
    common = ["-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20", "-maxrate", "12M", "-bufsize", "24M",
              "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2), "-c:a", "copy", "-movflags", "+faststart"]
    if vf:
        run(["ffmpeg", "-y", "-i", str(master), "-vf", vf, "-map", "0:v", "-map", "0:a", *common, str(out)])
    else:
        run(["ffmpeg", "-y", "-i", str(master), "-filter_complex", graph, "-map", "[v]", "-map", "0:a", *common, str(out)])


# --------------------------------------------------------------------------- Validation

def validate(path: Path, w: int, h: int) -> list[str]:
    info = probe(path)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    errs = []
    if not v:
        return ["missing video stream"]
    if v.get("codec_name") != "h264":
        errs.append(f"video codec {v.get('codec_name')} != h264")
    if v.get("pix_fmt") != "yuv420p":
        errs.append(f"pix_fmt {v.get('pix_fmt')} != yuv420p")
    if (v.get("width"), v.get("height")) != (w, h):
        errs.append(f"resolution {v.get('width')}x{v.get('height')} != {w}x{h}")
    num, den = (int(x) for x in v.get("r_frame_rate", "0/1").split("/"))
    if den == 0 or abs(num / den - FPS) > 0.01:
        errs.append(f"frame rate {v.get('r_frame_rate')} != {FPS}")
    if not a or a.get("codec_name") != "aac":
        errs.append("audio must be AAC")
    dur = float(info["format"]["duration"])
    if dur > MAX_DURATION_SEC:
        errs.append(f"duration {dur:.1f}s > {MAX_DURATION_SEC}s")
    size = int(info["format"]["size"])
    if size > MAX_BYTES:
        errs.append(f"size {size} > {MAX_BYTES}")
    return errs


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------- Main

THEMES = {
    "brand": "business team office",
    "cybersecurity": "cyber security computer",
    "finance": "financial advisor office",
    "real-estate": "real estate agent",
    "legal": "lawyer office documents",
}


def pick_storyline(library: dict, storyline_id: str | None, rotate: bool) -> dict:
    stories = library["storylines"]
    if storyline_id:
        for s in stories:
            if s["id"] == storyline_id:
                return s
        raise SystemExit(f"unknown storyline: {storyline_id}")
    if rotate:
        return stories[dt.date.today().toordinal() % len(stories)]
    raise SystemExit("pass --storyline <id> or --rotate")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--storyline")
    ap.add_argument("--rotate", action="store_true")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--voice", default="am_michael")
    ap.add_argument("--library", default=str(LIBRARY))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    library = json.loads(Path(args.library).read_text())
    story = pick_storyline(library, args.storyline, args.rotate)
    out_dir = Path(args.out) / story["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"storyline {story['id']} ({len(story['beats'])} beats, offline={args.offline})")

    pexels = None
    if not args.offline:
        key = os.environ.get("PEXELS_API_KEY", "").strip()
        if not key:
            log("PEXELS_API_KEY is not set; refusing to render publishable output")
            return 2
        pexels = Pexels(key)

    voice = Voice(args.offline, args.voice)
    with tempfile.TemporaryDirectory(prefix="gemvid-") as tmp:
        work = Path(tmp)
        beats = [Beat(i, b["role"], b["caption"], b["voiceover"], b["clip"], span_seconds(b["time"]))
                 for i, b in enumerate(story["beats"])]
        t = 0.0
        for b in beats:
            b.vo_path = work / f"vo{b.index:02d}.wav"
            b.vo_seconds = voice.synth(b.voiceover, b.vo_path)
            length = max(b.planned, b.vo_seconds + VO_TAIL_SEC)
            b.start, b.end = t, t + length
            t += length
        total = t + END_CARD_SEC
        if total > MAX_DURATION_SEC:
            log(f"timeline {total:.1f}s exceeds {MAX_DURATION_SEC}s")
            return 3

        fetch_clips(beats, work, pexels, THEMES.get(story["vertical"], story["vertical"]))
        cta = next((b for b in story["beats"] if b["role"] == "cta"), story["beats"][-1])
        ass = work / "captions.ass"
        ass.write_text(build_ass(beats, total, cta["caption"].rstrip(" →"), "gemcybersecurityassist.com"), encoding="utf-8")

        master = out_dir / f"{story['id']}.vertical_9x16.mp4"
        render_master(beats, work, ass, master)
        outputs = {"vertical_9x16": master}
        for name in ("feed_4x5", "landscape_16x9"):
            path = out_dir / f"{story['id']}.{name}.mp4"
            render_variant(master, name, path)
            outputs[name] = path

        records, failures = [], {}
        for name, path in outputs.items():
            spec = VARIANTS[name]
            errs = validate(path, spec["w"], spec["h"])
            if errs:
                failures[name] = errs
            records.append({"variant": name, "file": path.name, "platforms": spec["platforms"], "width": spec["w"], "height": spec["h"],
                            "durationSec": round(duration_of(path), 2), "bytes": path.stat().st_size, "sha256": sha256(path)})

        credits = [c for b in beats for c in b.credits]
        manifest = {
            "library": library["version"], "storyline": story["id"], "title": story["title"], "vertical": story["vertical"],
            "tags": story["tags"], "renderedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "status": "OFFLINE_TEST_NOT_PUBLISHABLE" if args.offline else "DRAFT_PENDING_APPROVAL",
            "post": story["post"], "outputs": records, "validation": {"passed": not failures, "failures": failures},
            "disclosures": {"syntheticVoice": not args.offline, "voiceModel": None if args.offline else f"kokoro:{args.voice}",
                            "stockFootage": "Pexels License", "peopleAreStockTalent": True},
            "credits": credits,
            "timeline": [{"beat": b.index, "role": b.role, "start": round(b.start, 2), "end": round(b.end, 2)} for b in beats],
        }
        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        log(f"wrote {len(records)} variants to {out_dir}")
        if failures:
            log(f"validation failed: {json.dumps(failures)}")
            return 4
    return 0


if __name__ == "__main__":
    sys.exit(main())
