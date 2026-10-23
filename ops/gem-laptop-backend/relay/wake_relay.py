#!/usr/bin/env python3
"""Loopback-only Wake-on-LAN relay for the GEM laptop backend."""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import re
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

VERSION = "3.2.0-alpha.1"
MAC_PATTERN = re.compile(r"^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$")
ALLOWED_POST_PATHS = {"/api/wake", "/api/wake-and-start"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_secret(path: Path, *, minimum_length: int = 32) -> str:
    secret = path.read_text(encoding="utf-8").strip()
    if len(secret) < minimum_length:
        raise RuntimeError(f"Secret file {path} is missing or too short")
    return secret


def bearer_token(headers: Any) -> str:
    value = str(headers.get("Authorization", ""))
    prefix = "Bearer "
    return value[len(prefix) :].strip() if value.lower().startswith(prefix.lower()) else ""


def secret_matches(expected: str, supplied: str) -> bool:
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def normalized_mac(value: str) -> bytes:
    if not MAC_PATTERN.fullmatch(value.strip()):
        raise ValueError("GEM_PC_MAC must be a six-byte MAC address")
    return bytes.fromhex(value.replace(":", "").replace("-", ""))


def validated_https_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("GEM_LAPTOP_URL must be an HTTPS URL without embedded credentials")
    return value.rstrip("/") + "/"


@dataclass(frozen=True)
class Config:
    bind: str
    port: int
    pc_mac: bytes
    broadcast: str
    laptop_url: str
    relay_token_file: Path
    laptop_token_file: Path
    state_file: Path
    audit_file: Path
    wake_timeout_seconds: int
    poll_interval_seconds: int

    @classmethod
    def from_environment(cls) -> "Config":
        bind = os.getenv("GEM_RELAY_BIND", "127.0.0.1")
        if bind not in {"127.0.0.1", "::1"}:
            raise ValueError("GEM_RELAY_BIND must remain loopback-only")

        broadcast = str(ipaddress.IPv4Address(os.environ["GEM_WOL_BROADCAST"]))
        return cls(
            bind=bind,
            port=int(os.getenv("GEM_RELAY_PORT", "8780")),
            pc_mac=normalized_mac(os.environ["GEM_PC_MAC"]),
            broadcast=broadcast,
            laptop_url=validated_https_url(os.environ["GEM_LAPTOP_URL"]),
            relay_token_file=Path(os.getenv("GEM_RELAY_TOKEN_FILE", "/etc/gem-relay/relay-token")),
            laptop_token_file=Path(os.getenv("GEM_LAPTOP_TOKEN_FILE", "/etc/gem-relay/laptop-token")),
            state_file=Path(os.getenv("GEM_RELAY_STATE_FILE", "/var/lib/gem-relay/status.json")),
            audit_file=Path(os.getenv("GEM_RELAY_AUDIT_FILE", "/var/log/gem-relay/audit.jsonl")),
            wake_timeout_seconds=max(30, min(600, int(os.getenv("GEM_WAKE_TIMEOUT_SECONDS", "240")))),
            poll_interval_seconds=max(2, min(30, int(os.getenv("GEM_POLL_INTERVAL_SECONDS", "5")))),
        )


class RelayState:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._lock = threading.Lock()
        self._value: dict[str, Any] = {
            "version": VERSION,
            "busy": False,
            "lastAction": None,
            "lastResult": None,
            "lastError": None,
            "laptopReachable": False,
            "updatedAt": utc_now(),
        }
        self._load()

    def _load(self) -> None:
        try:
            loaded = json.loads(self.config.state_file.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                self._value.update({key: loaded.get(key) for key in self._value})
                self._value["busy"] = False
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            pass

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._value)

    def update(self, **changes: Any) -> dict[str, Any]:
        with self._lock:
            self._value.update(changes)
            self._value["updatedAt"] = utc_now()
            snapshot = dict(self._value)
            self.config.state_file.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.config.state_file.with_suffix(".tmp")
            temporary.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
            os.replace(temporary, self.config.state_file)
            return snapshot


class GemRelay:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.state = RelayState(config)
        self.relay_token = read_secret(config.relay_token_file)
        self.ssl_context = ssl.create_default_context()

    def audit(self, event: dict[str, Any]) -> None:
        self.config.audit_file.parent.mkdir(parents=True, exist_ok=True)
        record = {"timestamp": utc_now(), **event}
        with self.config.audit_file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, separators=(",", ":")) + "\n")

    def send_magic_packet(self) -> None:
        packet = b"\xff" * 6 + self.config.pc_mac * 16
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(5)
            sock.sendto(packet, (self.config.broadcast, 9))

    def request_json(self, path: str, *, method: str = "GET", token: str | None = None, timeout: int = 8) -> dict[str, Any]:
        url = urljoin(self.config.laptop_url, path.lstrip("/"))
        headers = {"Accept": "application/json", "User-Agent": f"gem-relay/{VERSION}"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, method=method, headers=headers)
        with urllib.request.urlopen(request, timeout=timeout, context=self.ssl_context) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Laptop returned HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))

    def laptop_health(self) -> dict[str, Any] | None:
        try:
            return self.request_json("/api/health", timeout=5)
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, RuntimeError):
            return None

    def wait_for_laptop(self) -> dict[str, Any]:
        deadline = time.monotonic() + self.config.wake_timeout_seconds
        while time.monotonic() < deadline:
            health = self.laptop_health()
            if health and health.get("status") == "ok":
                self.state.update(laptopReachable=True)
                return health
            time.sleep(self.config.poll_interval_seconds)
        raise TimeoutError("Laptop backend did not become reachable before the wake timeout")

    def start_laptop_studio(self) -> dict[str, Any]:
        token = read_secret(self.config.laptop_token_file)
        return self.request_json("/api/commands/start", method="POST", token=token, timeout=12)

    def run_action(self, action: str, request_id: str) -> None:
        try:
            self.state.update(busy=True, lastAction=action, lastResult="wake-sent", lastError=None)
            self.send_magic_packet()
            health = self.wait_for_laptop()
            result: dict[str, Any] = {"health": health}
            if action == "wake-and-start":
                result["start"] = self.start_laptop_studio()
            self.state.update(busy=False, lastResult="accepted", lastError=None, laptopReachable=True)
            self.audit({"requestId": request_id, "action": action, "result": "accepted"})
        except Exception as error:  # noqa: BLE001 - daemon boundary records exact failure
            self.state.update(busy=False, lastResult="failed", lastError=str(error))
            self.audit({"requestId": request_id, "action": action, "result": "failed", "error": str(error)})


class Handler(BaseHTTPRequestHandler):
    relay: GemRelay
    server_version = f"GEMRelay/{VERSION}"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        if secret_matches(self.relay.relay_token, bearer_token(self.headers)):
            return True
        self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "UNAUTHORIZED"})
        return False

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler name
        if self.path == "/api/health":
            state = self.relay.state.snapshot()
            self.send_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "service": "gem-wake-relay",
                    "version": VERSION,
                    "busy": state["busy"],
                },
            )
            return

        if self.path == "/api/status" and self.authorized():
            health = self.relay.laptop_health()
            self.relay.state.update(laptopReachable=bool(health))
            self.send_json(HTTPStatus.OK, self.relay.state.snapshot())
            return

        self.send_json(HTTPStatus.NOT_FOUND, {"error": "NOT_FOUND"})

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler name
        if self.path not in ALLOWED_POST_PATHS:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "ACTION_NOT_ALLOWED"})
            return
        if not self.authorized():
            return

        action = "wake-and-start" if self.path.endswith("wake-and-start") else "wake"
        current = self.relay.state.snapshot()
        if current["busy"]:
            self.send_json(HTTPStatus.CONFLICT, {"error": "RELAY_BUSY"})
            return

        request_id = hashlib.sha256(f"{action}:{time.time_ns()}".encode()).hexdigest()[:24]
        thread = threading.Thread(target=self.relay.run_action, args=(action, request_id), daemon=True)
        thread.start()
        self.send_json(HTTPStatus.ACCEPTED, {"accepted": True, "action": action, "requestId": request_id})


def main() -> None:
    config = Config.from_environment()
    relay = GemRelay(config)
    Handler.relay = relay
    server = ThreadingHTTPServer((config.bind, config.port), Handler)
    print(f"GEM Wake Relay {VERSION} listening on http://{config.bind}:{config.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
