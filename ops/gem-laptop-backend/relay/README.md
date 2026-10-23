# Optional GEM Wake Relay

The laptop backend cannot answer while the laptop is asleep or powered off. This relay runs on an always-on Raspberry Pi, Linux NAS, router, or mini-PC on the same home LAN as the GEM laptop.

## Responsibility

```text
iPhone
  -> private relay URL over Tailscale
  -> Wake-on-LAN magic packet on the home LAN
  -> wait for GEM laptop Tailscale/HTTPS reachability
  -> optional fixed POST /api/commands/start to the laptop backend
```

The relay does not run Decart, Pinokio, OBS, GEM identity, approvals, or customer data.

## Security

- Bind the relay service to `127.0.0.1`.
- Expose it only with Tailscale Serve, never Funnel.
- Generate the relay bearer token locally.
- Store the laptop bearer token in a root-only file only when one-button wake-and-start is required.
- Accept only `wake` and `wake-and-start` actions.
- Never accept shell commands, executable paths, URLs, MAC addresses, or interface names from an HTTP request.
- Configure the target MAC address, broadcast address, laptop URL, and token-file paths in the systemd environment file.

## Installation

On the always-on Linux relay:

```bash
sudo bash install-relay.sh
```

The installer prompts for or reads these environment values:

```text
GEM_PC_MAC=AA:BB:CC:DD:EE:FF
GEM_WOL_BROADCAST=192.168.1.255
GEM_LAPTOP_URL=https://gem-assist.<tailnet>.ts.net
GEM_LAPTOP_TOKEN_FILE=/etc/gem-relay/laptop-token
```

It creates:

- `/opt/gem-relay/wake_relay.py`
- `/etc/gem-relay/relay.env`
- `/etc/gem-relay/relay-token`
- `/etc/systemd/system/gem-relay.service`
- a persistent Tailscale Serve proxy to `http://127.0.0.1:8780`

## Hardware limits

Wake-on-LAN must be supported and enabled in the actual laptop firmware and Ethernet adapter. Ethernet is strongly preferred. A laptop that is unplugged, has no home internet, has no power, or does not support wake from its current power state cannot be recovered by software.
