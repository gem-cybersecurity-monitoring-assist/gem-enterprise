# Provider Pause Contract (WS-A control plane → WS-B worker / WS-E orchestrator)

Status: implemented on branch `feat/social-automation-control-plane` (WS-A).
A provider pause stops **publishing** for one provider inside one workspace. It
does not disconnect the connector, delete credentials, or change the global
TokMetric emergency lock.

## Source of truth

Table `social_provider_pauses` (`workspace_id`, `provider`, `paused_at`,
`paused_by`, `reason`). One row per paused provider per workspace; absence of a
row means "not paused".

## Control-plane API (admin-only)

- `PUT /api/social-media/connectors/[provider]/pause`
  Body: `{ "workspaceId": string, "reason"?: string }`
  → `{ ok, provider, paused: true, pausedAt, pausedBy, reason }`
- `DELETE /api/social-media/connectors/[provider]/pause`
  Body: `{ "workspaceId": string }`
  → `{ ok, provider, paused: false, wasPaused }`

`[provider]` is one of `META | X | LINKEDIN | YOUTUBE | NEXTDOOR | TIKTOK`
(anything else → `400 UNSUPPORTED_SOCIAL_PROVIDER`). Both routes require an
active session, workspace access, `manage` permission on `connectors`, **and**
workspace administrator authority (workspace role `admin`/`owner`, or session
role `admin`/`super_admin`/`internal`). Same-origin requests only. Pause and
unpause are audited as `social.connector.provider_paused` /
`social.connector.provider_unpaused`.

## What consumers must honor

`GET /api/social-media/connectors?workspaceId=...` now returns:

```jsonc
{
  "ok": true,
  "connectors": [
    {
      "id": "...",
      "provider": "META",
      // ... existing safe fields ...
      "providerPaused": false,            // NEW: pause state for this connector
      "liveProbe": {                      // NEW: read-only health signal
        "lastProbedAt": "2026-09-29T11:00:00.000Z",  // null when never probed
        "probeOk": true,                  // null when never probed
        "source": "live"                  // "live" = probed within 15 min,
                                          // "config" = config-only fallback
      }
    }
  ],
  "pausedProviders": ["X"]                // NEW: workspace-level pause list
}
```

`POST /api/social-media/connectors/health` also returns `providerPaused:
boolean` and `liveProbe: { lastProbedAt, probeOk, source }` for the checked
connector.

### WS-B (publishing worker) obligations

1. Before claiming or executing any publish job, resolve the pause list for the
   job's workspace (`pausedProviders` from the connectors GET, or read
   `social_provider_pauses` directly server-side).
2. Map the job's provider id to the control-plane provider enum and **skip**
   (do not claim) jobs whose provider is paused. Suggested job outcome: keep the
   job `PENDING`/`BLOCKED` with a `provider_paused` note — do not mark
   `FAILED`, do not retry-loop against a paused provider.
3. Re-check pause state at execution time, not only at scheduling time: a pause
   may land between scheduling and execution.

### WS-E (orchestrator / scheduler) obligations

1. Exclude paused providers when building daily content plans and slot
   assignments for a workspace.
2. Surface the pause in scheduling UI/state as "paused by admin", distinct from
   `TOKEN_EXPIRED` / `REAUTHORIZATION_REQUIRED` / global emergency lock.

## Semantics and guarantees

- Pausing is **not** disconnecting: connectors keep state `CONNECTED`,
  credentials stay encrypted server-side, health checks keep running.
- A pause composes with the global emergency lock (`enforceEmergencyLocks`):
  either one blocks publishing; clearing one does not clear the other.
- Pause/unpause never touches provider APIs (no external calls) and never
  publishes.
- `liveProbe.source === "config"` means "no live measurement within the
  15-minute TTL" — never treat it as a live health signal.
