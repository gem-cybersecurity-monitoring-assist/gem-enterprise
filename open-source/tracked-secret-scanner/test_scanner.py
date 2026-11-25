# SPDX-License-Identifier: Apache-2.0
"""Standalone tests using only synthetic inputs and disposable Git repositories."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCANNER = Path(__file__).resolve().with_name("scan_tracked_secrets.py")


class ScannerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)

    def track(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        subprocess.run(["git", "add", "--", name], cwd=self.root, check=True)

    def scan(self):
        return subprocess.run([sys.executable, str(SCANNER)], cwd=self.root,
                              capture_output=True, text=True, check=False)

    def test_clean_and_templates(self):
        for name in (".env.example", ".env.sample", ".env.template", "clean.txt"):
            self.track(name, "PLACEHOLDER=example\n")
        (self.root / ".env.local").write_text("untracked", encoding="utf-8")
        result = self.scan()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_tracked_runtime_environment(self):
        self.track("nested/.env.production", "EXAMPLE=placeholder\n")
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn("tracked-runtime-environment-file", result.stdout)

    def test_token_and_redaction(self):
        token = "123456789" + ":" + "Z" * 35
        self.track("fixture.txt", "clean\n" + token + "\n")
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn("fixture.txt:2 [telegram-bot-token]", result.stdout)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_bot_url_and_redaction(self):
        token = "123456789" + ":" + "X" * 35
        self.track("url.txt", "https://api.telegram.org/bot" + token + "/getMe")
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn("telegram-token-in-api-url", result.stdout)
        self.assertNotIn(token, result.stdout + result.stderr)

    def test_public_secret_variable(self):
        variable = "NEXT_PUBLIC_" + "TELEGRAM_" + "BOT_TOKEN"
        self.track("config.txt", variable + "=placeholder")
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn("public-telegram-secret-variable", result.stdout)

    def test_large_tracked_file(self):
        self.track("large.txt", "a" * 1100000 + "\n" + "123456789" + ":" + "Q" * 35)
        result = self.scan()
        self.assertEqual(result.returncode, 1)
        self.assertIn("large.txt:2", result.stdout)


if __name__ == "__main__":
    unittest.main()
