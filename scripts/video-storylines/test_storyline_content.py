#!/usr/bin/env python3
"""Offline quality checks for GEM video storylines and narration timing."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = ROOT / "content" / "video-storylines" / "gem-storylines.v1.json"
MAX_WORDS_PER_MINUTE = 150


def main() -> int:
    data = json.loads(LIBRARY.read_text(encoding="utf-8"))
    stories = data.get("storylines", [])
    errors: list[str] = []
    story_ids: set[str] = set()
    total_beats = 0
    max_rate = 0.0

    if not stories:
        errors.append("storyline library is empty")

    for story in stories:
        story_id = story.get("id", "<missing-id>")
        if story_id in story_ids:
            errors.append(f"{story_id}: duplicate storyline id")
        story_ids.add(story_id)

        beats = story.get("beats", [])
        if not beats:
            errors.append(f"{story_id}: no beats")
            continue

        expected_start = 0
        for index, beat in enumerate(beats):
            total_beats += 1
            label = f"{story_id} beat {index + 1}"
            match = re.fullmatch(r"(\d+)-(\d+)", str(beat.get("time", "")))
            if not match:
                errors.append(f"{label}: time must use start-end seconds")
                continue

            start, end = map(int, match.groups())
            if start != expected_start:
                errors.append(f"{label}: starts at {start}s; expected {expected_start}s")
            if end <= start:
                errors.append(f"{label}: end must be after start")
                continue
            expected_start = end

            narration = str(beat.get("voiceover", "")).strip()
            if not narration:
                errors.append(f"{label}: voiceover is empty")
                continue
            words = len(re.findall(r"\b[\w’'-]+\b", narration))
            rate = words * 60.0 / (end - start)
            max_rate = max(max_rate, rate)
            if rate > MAX_WORDS_PER_MINUTE:
                errors.append(
                    f"{label}: narration is {rate:.0f} wpm; limit is {MAX_WORDS_PER_MINUTE} wpm"
                )

            clip = beat.get("clip", {})
            url = str(clip.get("url", ""))
            if not url.startswith("https://"):
                errors.append(f"{label}: clip reference must use HTTPS")
            if story_id.startswith("gem-cyber-"):
                query = str(clip.get("searchQuery", "")).strip()
                if not query:
                    errors.append(f"{label}: scene-specific Pixabay searchQuery is missing")
                elif len(query) > 100:
                    errors.append(f"{label}: Pixabay searchQuery exceeds 100 characters")

        if expected_start != story.get("durationSec"):
            errors.append(
                f"{story_id}: last beat ends at {expected_start}s, "
                f"but durationSec is {story.get('durationSec')}"
            )
        if not story.get("post", {}).get("caption"):
            errors.append(f"{story_id}: social caption is missing")
        if not story.get("post", {}).get("hashtags"):
            errors.append(f"{story_id}: hashtags are missing")

    if errors:
        print("Storyline content validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Storyline content OK: {len(stories)} storylines, {total_beats} beats; "
        f"maximum narration pace {max_rate:.0f} wpm (limit {MAX_WORDS_PER_MINUTE})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
