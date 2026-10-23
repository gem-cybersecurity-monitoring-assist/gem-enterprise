"""GEM short-form video + carousel generator.

Renders 1080x1920 MP4s (TikTok / Reels) and 1080x1920 photo-carousel PNGs from a
JSON post spec. Pure PIL + numpy + ffmpeg: no paid services, no network.

Optional free media (see media.py):
  PEXELS_API_KEY  real-people stock footage behind each scene ("footage" field)
  PIPER_MODEL     open-source voiceover from each scene's "say" field

Usage:
  python3 gem_reels.py posts.json OUT_DIR [--only ID]
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

from media import FrameReader, MediaKit, probe_duration
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
# TikTok UI covers the right rail and bottom caption area: keep text inside.
SAFE_L, SAFE_R, SAFE_T, SAFE_B = 90, W - 170, 360, H - 470

BG0 = (7, 12, 16)
BG1 = (10, 26, 28)
INK = (236, 242, 245)
MUTED = (150, 166, 176)
TEAL = (0, 201, 160)
RED = (240, 96, 96)
AMBER = (240, 184, 74)
CARD = (18, 28, 34)
LINE = (40, 58, 66)

FD = "/usr/share/fonts/opentype/inter/"
_fonts = {}


def F(size, w="Bold"):
    key = (size, w)
    if key not in _fonts:
        path = FD + f"Inter-{w}.otf"
        if not os.path.exists(path):
            path = FD + "Inter-Regular.otf"
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def M(size):
    key = ("mono", size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(MONO, size)
    return _fonts[key]


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def wrap(draw, text, font, maxw):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=font) > maxw and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


# ---------- background ----------
_bg_cache = {}


def background(t):
    if "base" not in _bg_cache:
        y = np.linspace(0, 1, H)[:, None]
        base = (np.array(BG0) * (1 - y) + np.array(BG1) * y)[:, None, :].repeat(W, axis=1)
        _bg_cache["base"] = Image.fromarray(base.astype(np.uint8))
        g = 900
        yy, xx = np.mgrid[-1:1:g * 1j, -1:1:g * 1j]
        alpha = np.clip(1 - np.sqrt(xx ** 2 + yy ** 2), 0, 1) ** 2 * 70
        glow = np.zeros((g, g, 4), dtype=np.uint8)
        glow[..., :3] = TEAL
        glow[..., 3] = alpha.astype(np.uint8)
        _bg_cache["glow"] = Image.fromarray(glow, "RGBA")
    img = _bg_cache["base"].copy().convert("RGBA")
    gx = int(W * 0.5 + 260 * math.sin(t * 0.35) - 450)
    gy = int(H * 0.38 + 220 * math.cos(t * 0.27) - 450)
    img.alpha_composite(_bg_cache["glow"], (gx, gy))
    # Grid on its own layer so its alpha blends instead of overwriting pixels.
    grid = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    off = int((t * 18) % 120)
    for x in range(-120 + off, W, 120):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 10))
    for y in range(-120 + off, H, 120):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 10))
    img.alpha_composite(grid)
    return img


def brand_tag(d, brand):
    d.text((SAFE_L, 150), brand.upper(), font=F(30, "SemiBold"), fill=TEAL)


def step_chip(d, label, x=SAFE_L, y=SAFE_T):
    font = F(34, "Bold")
    w = d.textlength(label, font=font) + 44
    d.rounded_rectangle((x, y, x + w, y + 64), 32, fill=TEAL)
    d.text((x + 22, y + 13), label, font=font, fill=BG0)
    return y + 64


def text_block(d, text, y, size=84, color=INK, weight="Black", reveal=1.0, lh=1.12):
    font = F(size, weight)
    lines = wrap(d, text, font, SAFE_R - SAFE_L)
    shown = max(1, math.ceil(len(lines) * reveal)) if reveal > 0 else 0
    for i, line in enumerate(lines[:shown]):
        d.text((SAFE_L, y), line, font=font, fill=color)
        y += int(size * lh)
    return y


# ---------- mock widgets (fictional brands only) ----------
def mock_email(img, y, p, data):
    d = ImageDraw.Draw(img)
    x0, x1 = SAFE_L, SAFE_R
    d.rounded_rectangle((x0, y, x1, y + 330), 28, fill=CARD, outline=LINE, width=2)
    d.ellipse((x0 + 32, y + 36, x0 + 112, y + 116), fill=(60, 80, 160))
    d.text((x0 + 72, y + 76), data["name"][0], font=F(40), fill=INK, anchor="mm")
    d.text((x0 + 136, y + 38), data["name"], font=F(40, "Bold"), fill=INK)
    addr_font = M(32)
    d.text((x0 + 136, y + 92), data["address"], font=addr_font, fill=MUTED)
    d.text((x0 + 32, y + 168), data["subject"], font=F(36, "SemiBold"), fill=INK)
    for i, line in enumerate(wrap(d, data["preview"], F(30, "Regular"), x1 - x0 - 64)[:2]):
        d.text((x0 + 32, y + 222 + i * 42), line, font=F(30, "Regular"), fill=MUTED)
    if "highlight" in data and p > 0.35:
        k = ease((p - 0.35) / 0.3)
        pre, bad = data["address"].split(data["highlight"], 1)[0], data["highlight"]
        hx = x0 + 136 + d.textlength(pre, font=addr_font)
        hw = d.textlength(bad, font=addr_font)
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        pad = 10
        od.rounded_rectangle((hx - pad, y + 84, hx + (hw + pad) * k + pad, y + 134), 10,
                             outline=RED + (255,), width=5)
        img.alpha_composite(ov)
    return y + 330


def mock_link(img, y, p, data):
    d = ImageDraw.Draw(img)
    x0, x1 = SAFE_L, SAFE_R
    bw = 560
    bx = (x0 + x1 - bw) // 2
    press = ease((p - 0.15) / 0.25)
    d.rounded_rectangle((bx, y, bx + bw, y + 120), 60, fill=(60, 90, 200))
    d.text(((bx * 2 + bw) // 2, y + 60), data["button"], font=F(42, "Bold"), fill=INK, anchor="mm")
    # finger press ring
    cx, cy = bx + bw // 2 + 120, y + 70
    r = int(36 + 30 * (1 - press))
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    od.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, int(90 * press)), outline=(255, 255, 255, int(200 * press)), width=4)
    img.alpha_composite(ov)
    d = ImageDraw.Draw(img)
    if p > 0.4:
        k = ease((p - 0.4) / 0.25)
        ty = y + 170 + int(30 * (1 - k))
        d.rounded_rectangle((x0, ty, x1, ty + 190), 24, fill=(28, 30, 36), outline=RED, width=4)
        d.text((x0 + 32, ty + 30), "This link actually goes to:", font=F(30, "SemiBold"), fill=MUTED)
        # URLs have no spaces: wrap by character width.
        maxw, lines, cur = x1 - x0 - 64, [], ""
        for ch in data["url"]:
            if d.textlength(cur + ch, font=M(34)) > maxw:
                lines.append(cur)
                cur = ch
            else:
                cur += ch
        lines.append(cur)
        for i, line in enumerate(lines[:2]):
            d.text((x0 + 32, ty + 82 + i * 46), line, font=M(34), fill=RED)
        return ty + 190
    return y + 120


def mock_alert(img, y, p, data):
    d = ImageDraw.Draw(img)
    x0, x1 = SAFE_L, SAFE_R
    shake = int(10 * math.sin(p * 60) * max(0, 1 - p * 2.5))
    d.rounded_rectangle((x0 + shake, y, x1 + shake, y + 300), 28, fill=(48, 18, 22), outline=RED, width=4)
    d.text((x0 + 40 + shake, y + 40), "⚠  URGENT", font=F(36, "Black"), fill=RED)
    for i, line in enumerate(wrap(d, data["text"], F(40, "Bold"), x1 - x0 - 80)[:3]):
        d.text((x0 + 40 + shake, y + 104 + i * 52), line, font=F(40, "Bold"), fill=INK)
    remaining = max(0, data.get("seconds", 86400) - int(p * 3600 * 6))
    hh, mm, ss = remaining // 3600, remaining % 3600 // 60, remaining % 60
    d.text((x1 - 40 + shake, y + 250), f"{hh:02d}:{mm:02d}:{ss:02d}", font=M(36), fill=RED, anchor="rm")
    return y + 300


MOCKS = {"email": mock_email, "link": mock_link, "alert": mock_alert}


# ---------- scenes ----------
def scene_hook(img, s, p, t, post):
    d = ImageDraw.Draw(img)
    brand_tag(d, post["brand"])
    k = ease(p / 0.35)
    y = SAFE_T + 120 + int(60 * (1 - k))
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    font = F(s.get("size", 104), "Black")
    yy = y
    for line in wrap(od, s["text"], font, SAFE_R - SAFE_L):
        od.text((SAFE_L, yy), line, font=font, fill=INK + (int(255 * k),))
        yy += int(s.get("size", 104) * 1.1)
    img.alpha_composite(ov)
    if s.get("sub") and p > 0.45:
        d = ImageDraw.Draw(img)
        k2 = ease((p - 0.45) / 0.3)
        d.text((SAFE_L, yy + 40), s["sub"], font=F(48, "SemiBold"), fill=tuple(int(c * k2) for c in TEAL))


def scene_point(img, s, p, t, post):
    d = ImageDraw.Draw(img)
    brand_tag(d, post["brand"])
    y = step_chip(d, s["chip"]) + 48
    k = ease(p / 0.3)
    y = text_block(d, s["title"], y, size=s.get("size", 92), reveal=k)
    y += 30
    if s.get("body") and p > 0.2:
        y = text_block(d, s["body"], y, size=46, color=MUTED, weight="Medium", reveal=ease((p - 0.2) / 0.3), lh=1.3)
    if s.get("mock"):
        MOCKS[s["mock"]["type"]](img, y + 60, p, s["mock"])


def scene_end(img, s, p, t, post):
    d = ImageDraw.Draw(img)
    k = ease(p / 0.4)
    cy = SAFE_T + 260
    font = F(112, "Black")
    for i, line in enumerate(s["lines"]):
        ki = ease((p - i * 0.12) / 0.35)
        color = TEAL if i == len(s["lines"]) - 1 else INK
        d.text((SAFE_L, cy + int(40 * (1 - ki))), line, font=font, fill=tuple(int(c * ki) for c in color))
        cy += 130
    d.line([(SAFE_L, cy + 50), (SAFE_L + int(320 * k), cy + 50)], fill=TEAL, width=6)
    d.text((SAFE_L, cy + 90), post["brand"], font=F(50, "Bold"), fill=INK)
    if s.get("cta"):
        d.text((SAFE_L, cy + 160), s["cta"], font=F(40, "Medium"), fill=MUTED)


SCENES = {"hook": scene_hook, "point": scene_point, "end": scene_end}


def progress_bar(img, t, total):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((SAFE_L, 100, SAFE_R, 108), 4, fill=(255, 255, 255, 30))
    d.rounded_rectangle((SAFE_L, 100, SAFE_L + int((SAFE_R - SAFE_L) * t / total), 108), 4, fill=TEAL)


_scrim = {}


def footage_background(raw):
    """Turns a raw RGB footage frame into a darkened, brand-tinted backdrop."""
    if "img" not in _scrim:
        y = np.linspace(0, 1, H)[:, None]
        # Darker at the top (titles) and bottom (captions + TikTok UI), lighter in the middle.
        alpha = 0.78 - 0.38 * np.exp(-((y - 0.55) ** 2) / 0.05)
        layer = np.zeros((H, W, 4), dtype=np.uint8)
        layer[..., :3] = BG0
        layer[..., 3] = (alpha * 255).astype(np.uint8)[:, :1].repeat(W, axis=1)
        _scrim["img"] = Image.fromarray(layer, "RGBA")
    frame = Image.frombuffer("RGB", (W, H), raw, "raw", "RGB", 0, 1).convert("RGBA")
    frame.alpha_composite(_scrim["img"])
    return frame


def caption_chunks(text, words_per_chunk=5):
    words = text.split()
    return [" ".join(words[i:i + words_per_chunk]) for i in range(0, len(words), words_per_chunk)]


def draw_caption(img, text, p):
    """Spoken-word caption: the chunk being said at progress p of the line."""
    chunks = caption_chunks(text)
    if not chunks:
        return
    total_words = sum(len(c.split()) for c in chunks)
    spoken, current = p * total_words, chunks[-1]
    acc = 0
    for chunk in chunks:
        acc += len(chunk.split())
        if spoken < acc:
            current = chunk
            break
    d = ImageDraw.Draw(img)
    font = F(50, "Bold")
    lines = wrap(d, current, font, SAFE_R - SAFE_L - 60)
    line_h = 64
    box_h = len(lines) * line_h + 36
    y0 = SAFE_B - box_h - 40
    widest = max(d.textlength(line, font=font) for line in lines)
    x0 = (SAFE_L + SAFE_R) // 2 - int(widest) // 2 - 30
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle((x0, y0, x0 + int(widest) + 60, y0 + box_h), 20, fill=(0, 0, 0, 170))
    img.alpha_composite(ov)
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text(((SAFE_L + SAFE_R) // 2, y0 + 18 + i * line_h), line, font=font, fill=INK, anchor="ma")


def prepare_media(post, kit, work):
    """Voices each scene, stretches scene timing to fit its narration, fetches footage."""
    voiced = post.get("voice", True)
    for i, s in enumerate(post["scenes"]):
        s["_audio"] = kit.speak(s.get("say"), f"{work}/a{i}.wav") if voiced else None
        if s["_audio"]:
            s["_speech"] = probe_duration(s["_audio"])
            s["dur"] = max(s["dur"], s["_speech"] + 0.6)
        else:
            s["_speech"] = 0.0
        s["_clip"] = kit.footage(s.get("footage"), s["dur"], f"{work}/c{i}.mp4")


def build_audio(post, work, total):
    """One track: each scene's narration starting at the scene start, padded to its duration."""
    inputs, filters, labels = [], [], []
    for i, s in enumerate(post["scenes"]):
        # ffmpeg numbers inputs by "-i" occurrence, so input i is scene i.
        if s.get("_audio"):
            inputs += ["-i", s["_audio"]]
            filters.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono,apad,atrim=0:{s['dur']:.3f}[s{i}]")
        else:
            inputs += ["-f", "lavfi", "-t", f"{s['dur']:.3f}", "-i", "anullsrc=channel_layout=mono:sample_rate=44100"]
            filters.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono[s{i}]")
        labels.append(f"[s{i}]")
    out = f"{work}/voice.m4a"
    voiced = any(s.get("_audio") for s in post["scenes"])
    tail = ",loudnorm=I=-16:TP=-1.5" if voiced else ""
    graph = ";".join(filters) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1{tail}[a]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[a]",
                    "-t", f"{total:.3f}", "-c:a", "aac", "-b:a", "160k", out], check=True)
    return out


def render_video(post, out_dir, kit):
    work = tempfile.mkdtemp(dir=out_dir)
    try:
        prepare_media(post, kit, work)
        total = sum(s["dur"] for s in post["scenes"])
        index, t0 = 0, 0.0
        for s in post["scenes"]:
            frames = int(round(s["dur"] * FPS))
            reader = FrameReader(s["_clip"], s["dur"], FPS) if s.get("_clip") else None
            for f in range(frames):
                t = t0 + f / FPS
                p = f / max(1, frames - 1)
                raw = reader.next() if reader else None
                img = footage_background(raw) if raw else background(t)
                SCENES[s["type"]](img, s, p, t, post)
                if f / FPS < 0.15:
                    a = int(255 * (1 - (f / FPS) / 0.15) * 0.6)
                    img.alpha_composite(Image.new("RGBA", img.size, BG0 + (a,)))
                if s.get("say") and s.get("_speech"):
                    draw_caption(img, s["say"], min(1.0, (f / FPS) / s["_speech"]))
                progress_bar(img, t, total)
                img.convert("RGB").save(f"{work}/f{index:05d}.png", compress_level=1)
                index += 1
            if reader:
                reader.close()
            t0 += s["dur"]
        audio = build_audio(post, work, total)
        out = os.path.join(out_dir, f"{post['id']}.mp4")
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", f"{work}/f%05d.png", "-i", audio,
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-shortest", "-movflags", "+faststart", out,
        ], check=True)
        return out
    finally:
        shutil.rmtree(work, ignore_errors=True)


def render_carousel(post, out_dir, kit=None):
    outs = []
    for i, s in enumerate(post["scenes"]):
        img = background(i * 2.3)
        SCENES[s["type"]](img, s, 1.0, 0, post)
        d = ImageDraw.Draw(img)
        d.text((SAFE_R, 160), f"{i + 1}/{len(post['scenes'])}", font=F(32, "SemiBold"), fill=MUTED, anchor="ra")
        path = os.path.join(out_dir, f"{post['id']}-{i + 1}.png")
        img.convert("RGB").save(path, optimize=True)
        outs.append(path)
    return outs


def main():
    spec_path, out_dir = sys.argv[1], sys.argv[2]
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    os.makedirs(out_dir, exist_ok=True)
    posts = json.load(open(spec_path))
    credits = []
    kit = MediaKit(out_dir, credits)
    print(f"voice: {'on' if kit.voice_available else 'off'} · footage: {'on' if kit.pexels_key else 'off'}")
    for post in posts:
        if only and post["id"] != only:
            continue
        if post["format"] == "video":
            print(render_video(post, out_dir, kit))
        else:
            print("\n".join(render_carousel(post, out_dir, kit)))
        # Per-post caption file for pasting into TikTok.
        if post.get("caption"):
            with open(os.path.join(out_dir, f"{post['id']}.txt"), "w") as handle:
                handle.write(post["caption"].strip() + "\n\n" + post.get("hashtags", "").strip() + "\n")
    with open(os.path.join(out_dir, "CREDITS.json"), "w") as handle:
        json.dump(credits, handle, indent=2)


if __name__ == "__main__":
    main()
