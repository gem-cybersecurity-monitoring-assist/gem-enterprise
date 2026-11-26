#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Fail closed on supported credential patterns or unsafe tracked files.

This scanner intentionally prints only file paths, line numbers, and rule names. It
never prints matched secret values. Tracked files are streamed line-by-line so large
artifacts are scanned rather than silently skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import subprocess
from pathlib import Path

TELEGRAM_TOKEN = re.compile(r"(?<![A-Za-z0-9_])\d{6,12}:[A-Za-z0-9_-]{30,}(?![A-Za-z0-9_-])")
TELEGRAM_URL_TOKEN = re.compile(r"api\.telegram\.org/bot\d{6,12}:[A-Za-z0-9_-]{30,}", re.IGNORECASE)
PUBLIC_TELEGRAM_SECRET_NAME = re.compile(
    r"(?i)\bNEXT_PUBLIC_[A-Z0-9_]*(?:TELEGRAM|BOT)[A-Z0-9_]*(?:TOKEN|SECRET|KEY)\b"
)

VERSION = "0.2.0"
# Deliberately narrow shapes; identifiers and headers are not proof of live secrets.
EXTRA_RULES = (
    ("github-classic-token", re.compile(r"(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9_])")),
    ("github-fine-grained-token", re.compile(r"(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{82}(?![A-Za-z0-9_])")),
    ("aws-access-key-id", re.compile(r"(?<![A-Za-z0-9_])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9_])")),
    ("private-key-header", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----")),
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
    # Reject symlinks at every path component, including substituted directories.
    # Descriptor-relative opens prevent a symlink swap between checking and opening.
    if not hasattr(os, "O_NOFOLLOW") or os.open not in os.supports_dir_fd:
        return [(0, "unsupported-safe-file-access")]
    if path.is_absolute() or not path.parts or ".." in path.parts:
        return [(0, "unsafe-tracked-path")]
    directory = None
    fd = None
    try:
        directory = os.open(".", os.O_RDONLY | os.O_DIRECTORY)
        for part in path.parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = child
        fd = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            return [(0, "unsafe-tracked-file-type")]
        handle = os.fdopen(fd, "r", encoding="utf-8", errors="ignore")
        fd = None
        with handle:
            for line_number, line in enumerate(handle, start=1):
                if PUBLIC_TELEGRAM_SECRET_NAME.search(line):
                    findings.append((line_number, "public-telegram-secret-variable"))
                if TELEGRAM_URL_TOKEN.search(line):
                    findings.append((line_number, "telegram-token-in-api-url"))
                elif TELEGRAM_TOKEN.search(line):
                    findings.append((line_number, "telegram-bot-token"))
                for rule, pattern in EXTRA_RULES:
                    if pattern.search(line):
                        findings.append((line_number, rule))
    except OSError:
        # A tracked file that cannot be inspected is not treated as clean.
        findings.append((0, "tracked-file-read-error"))
    finally:
        if fd is not None:
            os.close(fd)
        if directory is not None:
            os.close(directory)

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan Git-tracked working-tree files from the repository root.")
    parser.add_argument("--version", action="version", version=VERSION)
    parser.parse_args()
    findings: list[tuple[str, int, str]] = []

    try:
        prefix = subprocess.run(
            ["git", "rev-parse", "--show-prefix"], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout.strip()
        inside = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        ).stdout.strip()
        if prefix or inside != b"true":
            print("Scan unavailable: run from the root of a Git working tree.")
            return 2
        filenames = tracked_files()
    except (OSError, subprocess.CalledProcessError, UnicodeError):
        print("Scan unavailable: Git tracked files could not be enumerated safely.")
        return 2

    for filename in filenames:
        path = Path(filename)

        if is_runtime_env_file(path):
            findings.append((filename, 0, "tracked-runtime-environment-file"))

        for line_number, rule in inspect_file(path):
            findings.append((filename, line_number, rule))

    if findings:
        print("Tracked secret scan failed. Sensitive or unsafe tracked material was found:")
        for filename, line_number, rule in findings:
            # Escape control characters in tracked paths so filenames cannot inject log lines.
            safe_name = json.dumps(filename, ensure_ascii=True)[1:-1]
            location = f"{safe_name}:{line_number}" if line_number else safe_name
            print(f"- {location} [{rule}]")
        print("Secret values are intentionally not printed. Remove tracked runtime env files and rotate exposed credentials before release.")
        return 1

    print("Tracked secret scan passed: no supported findings detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
