# GEM Laptop Backend Security Model

## Trust boundaries

1. **Canonical GEM Enterprise application** — owns signed sessions, roles, entitlements, approvals, audit records, and customer data.
2. **Laptop backend** — owns only local device status and a fixed-action request queue.
3. **Interactive session agent** — runs under the signed-in GEM ASSIST Windows user because OBS, cameras, Pinokio, and Decart require the desktop session.
4. **Base44** — optional internal orchestration and visualization only. It is never an authority for identity, licensing, entitlements, approvals, or private sessions.
5. **Tailscale Serve** — private transport from the phone to the loopback-only backend.

## Secret handling

The repository and release artifacts must never contain:

- Decart API keys
- Windows passwords
- ShellFish passwords
- SSH private keys
- Tailscale auth keys
- laptop bearer tokens
- Base44 connector secrets
- GEM session cookies or JWTs

The Windows installer generates the laptop bearer token locally with a cryptographic random number generator. It stores the token under `C:\ProgramData\GEM Continuity` and applies Windows ACLs for SYSTEM, local administrators, and the signed-in GEM ASSIST user only.

## API policy

- `GET /api/health` returns a redacted liveness summary.
- Every other API route requires the locally generated bearer token.
- Mutations are limited to the explicit allowlist: `start`, `stop`, `restart`, `open`, `base44`, `doctor`, and `sleep`.
- No route executes arbitrary PowerShell, shell commands, paths, URLs, or user-provided arguments.
- Request files contain only the action, request identifier, source, and timestamp.
- Every accepted mutation is written to an append-only local JSONL audit log.
- The backend binds to `127.0.0.1`; Tailscale Serve is the only supported remote HTTP path.
- Public Funnel exposure is prohibited.

## Fail-closed behavior

Installation or startup must stop when:

- the interactive Windows identity is not the expected signed-in user;
- the command is run as `gemremote`;
- the existing GEM Call Studio orchestrator is missing;
- the expected Pinokio MAIN directory is missing;
- Tailscale is not authenticated;
- the access token is missing or shorter than 32 characters;
- the interactive agent does not refresh status;
- the running agent does not report the 300-second startup grace period.

The installer does not move backup folders, reinstall dependencies, edit Decart credentials, force-stop all Node processes, or treat identical camera and transformed output as success.

## Manual release gates

The following remain manual, explicit gates:

- OBS recovery dialog must use Normal Mode.
- Decart key entry remains local to Windows.
- Transformed output must visibly differ from the physical camera.
- The verified AI/generating state and advancing remote frames must be observed.
- OBS Browser Source and OBS Virtual Camera must be verified in a real call.
- Wake-on-LAN must be tested with the actual laptop firmware, Ethernet adapter, and an always-on relay.

## Public repository note

This project lives in the canonical public repository, so code and documentation must remain secret-free. Deployment secrets are generated or configured only on the target laptop and must never be committed, attached to issues, pasted into pull requests, or included in screenshots.