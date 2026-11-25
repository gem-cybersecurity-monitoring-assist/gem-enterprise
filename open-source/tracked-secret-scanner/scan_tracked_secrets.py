#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Fail closed when tracked files contain Telegram credentials or runtime env files.

This scanner intentionally prints only file paths, line numbers, and rule names. It
never prints matched secret values. Tracked files are streamed line-by-line so large
artifacts are scanned rather than silently skipped.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

TELEGRAM_TOKEN = re.compile(r"(?<![A-Za-z0-9_])\d{6,12}:[A-Za-z0-9_-]{30,}(?![A-Za-z0-9_-])")
TELEGRAM_URL_TOKEN = re.compile(r"api\.telegram\.org/bot\d{6,12}:[A-Za-z0-9_-]{30,}", re.IGNORECASE)
PUBLIC_TELEGRAM_SECRET_NAME = re.compile(
    r"(?i)\bNEXT_PUBLIC_[A-Z0-9_]*(?:TELEGRAM|BOT)[A-Z0-9_]*(?:TOKEN|SECRET|KEY)\b"
)

SAFE_ENV_EXAMPLES = {".env.example", ".env.sample", ".env.template"}


def tracked_files() -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files", "-z"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return [item.decode("utf-8") for item in proc.stdout.split(b"\0") if item]


def is_runtime_env_file(path: Path) -> bool:
    name = path.name.lower()
    if name in SAFE_ENV_EXAMPLES:
        return False
    return name == ".env" or name.startswith(".env.")


def inspect_file(path: Path) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    if not path.is_file():
        return findings

    try:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line_number, line in enumerate(handle, start=1):
                if PUBLIC_TELEGRAM_SECRET_NAME.search(line):
                    findings.append((line_number, "public-telegram-secret-variable"))
                if TELEGRAM_URL_TOKEN.search(line):
                    findings.append((line_number, "telegram-token-in-api-url"))
                    continue
                if TELEGRAM_TOKEN.search(line):
                    findings.append((line_number, "telegram-bot-token"))
    except OSError:
        # A tracked file that cannot be inspected is not treated as clean.
        findings.append((0, "tracked-file-read-error"))

    return findings


def main() -> int:
    findings: list[tuple[str, int, str]] = []

    for filename in tracked_files():
        path = Path(filename)

        if is_runtime_env_file(path):
            findings.append((filename, 0, "tracked-runtime-environment-file"))

        for line_number, rule in inspect_file(path):
            findings.append((filename, line_number, rule))

    if findings:
        print("Tracked secret scan failed. Sensitive or unsafe tracked material was found:")
        for filename, line_number, rule in findings:
            location = f"{filename}:{line_number}" if line_number else filename
            print(f"- {location} [{rule}]")
        print("Secret values are intentionally not printed. Remove tracked runtime env files and rotate exposed credentials before release.")
        return 1

    print("Tracked secret scan passed: no tracked runtime env files or Telegram credential patterns detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
