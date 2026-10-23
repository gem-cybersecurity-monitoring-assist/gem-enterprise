#!/usr/bin/env bash
set -euo pipefail

VERSION="3.2.0-alpha.1"
INSTALL_ROOT="/opt/gem-relay"
CONFIG_ROOT="/etc/gem-relay"
STATE_ROOT="/var/lib/gem-relay"
LOG_ROOT="/var/log/gem-relay"
SERVICE_NAME="gem-relay.service"
SERVICE_USER="gem-relay"
RELAY_PORT="8780"

usage() {
  cat <<'EOF'
Usage:
  sudo bash install-relay.sh \
    --pc-mac AA:BB:CC:DD:EE:FF \
    --broadcast 192.168.1.255 \
    --laptop-url https://gem-assist.example-tailnet.ts.net \
    [--laptop-token-file /etc/gem-relay/laptop-token]

The laptop token file is optional for wake-only operation and required for
/api/wake-and-start. Never pass the token itself on the command line.
EOF
}

PC_MAC=""
BROADCAST=""
LAPTOP_URL=""
LAPTOP_TOKEN_FILE="${CONFIG_ROOT}/laptop-token"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pc-mac)
      PC_MAC="${2:-}"
      shift 2
      ;;
    --broadcast)
      BROADCAST="${2:-}"
      shift 2
      ;;
    --laptop-url)
      LAPTOP_URL="${2:-}"
      shift 2
      ;;
    --laptop-token-file)
      LAPTOP_TOKEN_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo or as root." >&2
  exit 1
fi

for command_name in python3 systemctl tailscale openssl install; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! "${PC_MAC}" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]; then
  echo "--pc-mac must use AA:BB:CC:DD:EE:FF format." >&2
  exit 1
fi

python3 - "${BROADCAST}" "${LAPTOP_URL}" <<'PY'
import ipaddress
import sys
from urllib.parse import urlparse

broadcast, laptop_url = sys.argv[1:]
ipaddress.IPv4Address(broadcast)
parsed = urlparse(laptop_url)
if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
    raise SystemExit("--laptop-url must be an HTTPS URL without embedded credentials")
PY

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE="${SOURCE_DIR}/wake_relay.py"

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "wake_relay.py must be beside install-relay.sh." >&2
  exit 1
fi

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${STATE_ROOT}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

install -d -m 0750 -o root -g "${SERVICE_USER}" "${INSTALL_ROOT}" "${CONFIG_ROOT}"
install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_USER}" "${STATE_ROOT}" "${LOG_ROOT}"
install -m 0755 -o root -g root "${SOURCE_FILE}" "${INSTALL_ROOT}/wake_relay.py"

RELAY_TOKEN_FILE="${CONFIG_ROOT}/relay-token"
if [[ ! -f "${RELAY_TOKEN_FILE}" ]]; then
  umask 0077
  openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n' > "${RELAY_TOKEN_FILE}"
fi

chown root:"${SERVICE_USER}" "${RELAY_TOKEN_FILE}"
chmod 0640 "${RELAY_TOKEN_FILE}"

if [[ ! -f "${LAPTOP_TOKEN_FILE}" ]]; then
  install -m 0640 -o root -g "${SERVICE_USER}" /dev/null "${LAPTOP_TOKEN_FILE}"
  echo "Created empty laptop token file: ${LAPTOP_TOKEN_FILE}"
  echo "Wake-only works now. Copy the laptop backend token into this file later for wake-and-start."
else
  chown root:"${SERVICE_USER}" "${LAPTOP_TOKEN_FILE}"
  chmod 0640 "${LAPTOP_TOKEN_FILE}"
fi

ENV_FILE="${CONFIG_ROOT}/relay.env"
cat > "${ENV_FILE}" <<EOF
GEM_RELAY_BIND=127.0.0.1
GEM_RELAY_PORT=${RELAY_PORT}
GEM_PC_MAC=${PC_MAC}
GEM_WOL_BROADCAST=${BROADCAST}
GEM_LAPTOP_URL=${LAPTOP_URL%/}
GEM_RELAY_TOKEN_FILE=${RELAY_TOKEN_FILE}
GEM_LAPTOP_TOKEN_FILE=${LAPTOP_TOKEN_FILE}
GEM_RELAY_STATE_FILE=${STATE_ROOT}/status.json
GEM_RELAY_AUDIT_FILE=${LOG_ROOT}/audit.jsonl
GEM_WAKE_TIMEOUT_SECONDS=240
GEM_POLL_INTERVAL_SECONDS=5
EOF

chown root:"${SERVICE_USER}" "${ENV_FILE}"
chmod 0640 "${ENV_FILE}"

UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}"
cat > "${UNIT_PATH}" <<EOF
[Unit]
Description=GEM Wake Relay ${VERSION}
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/python3 ${INSTALL_ROOT}/wake_relay.py
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ReadWritePaths=${STATE_ROOT} ${LOG_ROOT}
RestrictAddressFamilies=AF_INET AF_INET6
LockPersonality=true
MemoryDenyWriteExecute=true
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
EOF

chmod 0644 "${UNIT_PATH}"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

for _ in $(seq 1 30); do
  if python3 - <<PY
import json
import urllib.request
with urllib.request.urlopen("http://127.0.0.1:${RELAY_PORT}/api/health", timeout=2) as response:
    payload = json.load(response)
    raise SystemExit(0 if payload.get("status") == "ok" else 1)
PY
  then
    break
  fi
  sleep 1
done

if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
  journalctl -u "${SERVICE_NAME}" -n 80 --no-pager >&2 || true
  echo "GEM relay service failed to start." >&2
  exit 1
fi

SERVE_OUTPUT="$(tailscale serve --bg --yes "http://127.0.0.1:${RELAY_PORT}" 2>&1 || true)"
DNS_NAME="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("Self",{}).get("DNSName","").rstrip("."))' || true)"
PRIVATE_URL="${DNS_NAME:+https://${DNS_NAME}}"
ACCESS_FILE="/root/GEM-RELAY-ACCESS.txt"

cat > "${ACCESS_FILE}" <<EOF
GEM WAKE RELAY ${VERSION}

Private URL: ${PRIVATE_URL:-Tailscale Serve did not return a DNS name}
Relay token: $(cat "${RELAY_TOKEN_FILE}")

Wake endpoint: POST /api/wake
Wake-and-start endpoint: POST /api/wake-and-start
Status endpoint: GET /api/status

Keep the relay token private. Do not commit it or paste it into issues or chat.
The laptop bearer token belongs only in ${LAPTOP_TOKEN_FILE} with mode 0640.

Tailscale Serve result:
${SERVE_OUTPUT}
EOF
chmod 0600 "${ACCESS_FILE}"

cat <<EOF

GEM WAKE RELAY INSTALLATION PASSED
Service: ${SERVICE_NAME}
Private URL: ${PRIVATE_URL:-unavailable; inspect ${ACCESS_FILE}}
Access file: ${ACCESS_FILE}

Wake-only is ready now. Wake-and-start becomes ready after the laptop token is
placed in ${LAPTOP_TOKEN_FILE}.
EOF
