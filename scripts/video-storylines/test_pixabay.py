#!/usr/bin/env python3
"""Offline tests for the Pixabay stock-video adapter."""
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
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("could not load video storyline renderer")
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
    def setUp(self) -> None:
        self.payload = {
            "hits": [
                {
                    "id": 101,
                    "pageURL": "https://pixabay.com/videos/id-101/",
                    "user": "CreatorOne",
                    "videos": {
                        "large": {"url": "https://cdn.example/101-large.mp4", "width": 1080, "height": 1920},
                        "medium": {"url": "https://cdn.example/101-medium.mp4", "width": 720, "height": 1280},
                    },
                },
                {
                    "id": 202,
                    "pageURL": "https://pixabay.com/videos/id-202/",
                    "user": "CreatorTwo",
                    "videos": {
                        "large": {"url": "https://cdn.example/202-large.mp4", "width": 1920, "height": 1080},
                    },
                },
            ]
        }

    def test_search_results_are_cached_for_24_hours_without_storing_key(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            client = render.Pixabay("unit-test-secret", Path(directory))
            with patch.object(render.urllib.request, "urlopen", return_value=FakeResponse(self.payload)) as request:
                first = client.search("cyber awareness footage")
                second = client.search("cyber awareness footage")

            self.assertEqual(first, self.payload)
            self.assertEqual(second, self.payload)
            request.assert_called_once()
            cache_files = list(Path(directory).glob("*.json"))
            self.assertEqual(len(cache_files), 1)
            self.assertNotIn("unit-test-secret", cache_files[0].read_text(encoding="utf-8"))

    def test_portrait_filter_excludes_landscape_results(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            client = render.Pixabay("unit-test-secret", Path(directory))
            with patch.object(render.urllib.request, "urlopen", return_value=FakeResponse(self.payload)):
                results = client.search_portrait("cyber security office", exclude=set())

            self.assertEqual([item["id"] for item in results], [101])

    def test_best_file_prefers_smallest_rendition_covering_vertical_output(self) -> None:
        video = self.payload["hits"][0]
        selected = render.Pixabay.best_file(video)
        self.assertEqual(selected["url"], "https://cdn.example/101-large.mp4")
        self.assertEqual((selected["width"], selected["height"]), (1080, 1920))

    def test_empty_search_query_is_rejected_before_network_access(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            client = render.Pixabay("unit-test-secret", Path(directory))
            with patch.object(render.urllib.request, "urlopen") as request:
                with self.assertRaises(ValueError):
                    client.search("   ")
                request.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
