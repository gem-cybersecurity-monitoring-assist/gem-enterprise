# GEM Laptop Backend

Local-first Windows control plane for GEM Studio.

This service runs on the GEM laptop and exposes a private dashboard plus a fixed-action API for the installed Decart, Pinokio, and OBS workflow. GitHub stores source, tests, and release artifacts only; it does not run the live video pipeline.

## Authority boundaries

- Canonical GEM identity, approval, entitlement, audit, and customer data remain in the main GEM Enterprise application and approved PostgreSQL/Prisma boundary.
- Base44 remains an optional internal orchestration surface. It is not an account, approval, license, entitlement, or private-session authority.
- The laptop backend never accepts browser-supplied roles.
- Decart credentials remain protected on Windows and are never committed, returned by the API, or included in Base44 payloads.
- Only fixed actions are accepted: `start`, `stop`, `restart`, `status`, `open`, `base44`, `doctor`, and `sleep`.
- The expected Pinokio MAIN path is `C:\pinokio\api\gem-decart-live-studio`. Backup folders are never auto-launched.
- OBS Virtual Camera remains a manual release gate until live output is visibly transformed and verified.

## Runtime layout

```text
iPhone or laptop browser
        |
        | Tailscale HTTPS or loopback
        v
GEM Laptop Backend (Windows background task, port 8766)
        |
        | protected fixed-action request queue
        v
Interactive Session Agent (GEM ASSIST desktop)
        |
        +--> Pinokio MAIN
        +--> GEM Call Studio backend: 127.0.0.1:8765
        +--> OBS Normal Mode + WebSocket 4455
        +--> OBS Virtual Camera after manual validation
```

## Local URLs

- Dashboard: `http://127.0.0.1:8766`
- Health: `http://127.0.0.1:8766/api/health`
- Status: `http://127.0.0.1:8766/api/status`

The installer can enable Tailscale Serve so the dashboard is reachable privately from the phone. The exact HTTPS hostname is discovered on the laptop and written to the installation report.

## Install

Run `windows/install.ps1` once from Windows PowerShell as Administrator while signed in to the `GEM ASSIST` desktop.

The installer does not blindly reinstall or repair Pinokio, Decart, OBS, Node, or npm dependencies. It verifies prerequisites, installs this control plane, registers the background and interactive tasks, creates a local bearer token, configures ACLs, and fails closed when required evidence is missing.

## Development

```bash
cd ops/gem-laptop-backend
npm test
npm start
```

No package installation is required; the backend uses Node.js built-ins only.

## Current release

`3.2.0-alpha.1`

This branch is intentionally a guarded alpha. Live Decart transformation, OBS Virtual Camera output, Base44 registration, Wake-on-LAN hardware support, and one real call remain manual release gates.