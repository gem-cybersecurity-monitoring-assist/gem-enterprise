import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("wake_relay.py")
SPEC = importlib.util.spec_from_file_location("wake_relay", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class RelayValidationTests(unittest.TestCase):
    def test_normalized_mac_accepts_colons(self):
        value = MODULE.normalized_mac("AA:BB:CC:DD:EE:FF")
        self.assertEqual(value, bytes.fromhex("AABBCCDDEEFF"))

    def test_normalized_mac_rejects_command_text(self):
        with self.assertRaises(ValueError):
            MODULE.normalized_mac("AA:BB:CC:DD:EE:FF;reboot")

    def test_laptop_url_requires_https_and_no_credentials(self):
        self.assertEqual(
            MODULE.validated_https_url("https://gem-assist.example.ts.net"),
            "https://gem-assist.example.ts.net/",
        )
        with self.assertRaises(ValueError):
            MODULE.validated_https_url("http://100.64.0.1:8766")
        with self.assertRaises(ValueError):
            MODULE.validated_https_url("https://user:pass@example.ts.net")

    def test_secret_comparison_is_exact(self):
        self.assertTrue(MODULE.secret_matches("x" * 32, "x" * 32))
        self.assertFalse(MODULE.secret_matches("x" * 32, "y" * 32))
        self.assertFalse(MODULE.secret_matches("x" * 32, "x" * 31))

    def test_environment_rejects_non_loopback_bind(self):
        environment = {
            "GEM_RELAY_BIND": "0.0.0.0",
            "GEM_PC_MAC": "AA:BB:CC:DD:EE:FF",
            "GEM_WOL_BROADCAST": "192.168.1.255",
            "GEM_LAPTOP_URL": "https://gem-assist.example.ts.net",
        }
        with patch.dict(os.environ, environment, clear=True):
            with self.assertRaises(ValueError):
                MODULE.Config.from_environment()

    def test_read_secret_requires_minimum_length(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "token")
            path.write_text("short", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                MODULE.read_secret(path)


if __name__ == "__main__":
    unittest.main()
