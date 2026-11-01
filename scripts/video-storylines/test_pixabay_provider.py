"""Unit tests for the Pixabay stock-video provider (no network access)."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("render.py")
SPEC = importlib.util.spec_from_file_location("gem_video_storylines_render", MODULE_PATH)
assert SPEC and SPEC.loader
render = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = render
SPEC.loader.exec_module(render)


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.payload


class PixabayProviderTests(unittest.TestCase):
    def test_search_response_is_cached(self) -> None:
        payload = {"hits": [{"id": 10}]}
        with tempfile.TemporaryDirectory() as tmp:
            provider = render.Pixabay("test-key", Path(tmp))
            with patch.object(render.urllib.request, "urlopen", return_value=FakeResponse(payload)) as urlopen:
                self.assertEqual(provider._get({"q": "security"}), payload)
                self.assertEqual(provider._get({"q": "security"}), payload)
                self.assertEqual(urlopen.call_count, 1)

    def test_expired_search_cache_is_refreshed(self) -> None:
        payload = {"hits": [{"id": 11}]}
        with tempfile.TemporaryDirectory() as tmp:
            provider = render.Pixabay("test-key", Path(tmp))
            params = {"q": "cybersecurity"}
            identity = json.dumps({"endpoint": "/api/videos/", "params": params}, sort_keys=True)
            import hashlib
            cache_file = Path(tmp) / (hashlib.sha256(identity.encode()).hexdigest() + ".json")
            cache_file.write_text(json.dumps({"hits": [{"id": 1}]}), encoding="utf-8")
            with patch.object(render.urllib.request, "urlopen", return_value=FakeResponse(payload)) as urlopen:
                with patch.object(Path, "stat", wraps=Path.stat) as _stat:
                    # Set the cache timestamp outside the 24-hour freshness window.
                    import os
                    os.utime(cache_file, (1, 1))
                self.assertEqual(provider._get(params), payload)
                self.assertEqual(urlopen.call_count, 1)

    def test_search_prefers_unused_portrait_results(self) -> None:
        hits = [
            {"id": 1, "videos": {"medium": {"url": "landscape.mp4", "width": 1920, "height": 1080}}},
            {"id": 2, "videos": {"medium": {"url": "portrait.mp4", "width": 1080, "height": 1920}}},
        ]
        provider = render.Pixabay("test-key", Path(tempfile.gettempdir()) / "pixabay-provider-test")
        with patch.object(provider, "_get", return_value={"hits": hits}):
            self.assertEqual([v["id"] for v in provider.search_portrait("security", {2})], [1])
            self.assertEqual([v["id"] for v in provider.search_portrait("security", set())], [2])

    def test_best_file_selects_portrait_full_hd_rendition(self) -> None:
        video = {
            "id": 99,
            "videos": {
                "large": {"url": "landscape.mp4", "width": 3840, "height": 2160},
                "medium": {"url": "portrait-hd.mp4", "width": 1080, "height": 1920},
                "small": {"url": "portrait-small.mp4", "width": 720, "height": 1280},
            },
        }
        self.assertEqual(render.Pixabay.best_file(video)["url"], "portrait-hd.mp4")


if __name__ == "__main__":
    unittest.main()
