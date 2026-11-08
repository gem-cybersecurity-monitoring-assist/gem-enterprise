# GEM Sentinel collector trust boundary

Status: contract only; **not a deployed webhook, authenticated API, or durable incident store**.

A new pure evaluation function provides a mandatory *second* defensive gate between the future authenticated collector and the normalized Sentinel triage engine. Trust booleans passed to this function must be created by a privileged server-side adapter based on validated runtime evidence, never taken from an HTTP request body.

## Future collector obligations
1. Use the existing GEM server-side session/credential infrastructure. Validate inbound signed credentials against bound integration and tenant records. No globally shared token.
2. Enforce size caps, bounded JSON parsing, per-integration rate limits, credential rotation, request timestamp and nonce/replay cache.
3. Determine canonical tenant and source from verified database configuration; never trust alert payload tenant identifiers.
4. Validate exact source schemas, allowlists, safe title truncation and stored evidence redaction before ingestion.
5. Persist incoming event and incident in a transaction with unique (tenant, source, sourceEventId) for idempotency. This module only says READY_FOR_PERSISTENCE and does NOT imply persistence.
6. Enforce tenant-scoped reads at the database and API layers; create no anonymous incident browse endpoints.
7. Log collector denials without logging secrets, raw personal data, credentials or complete payloads.
8. Operator-controlled deletion, retention, encrypted backup and actual restore rehearsal.
9. Verify integration authenticity, alert origins, outbound network restrictions and availability in a disposable lab before any live enrollment.

Do not expose evaluateIncomingSecurityAlert directly as a public HTTP route without satisfying these requirements.

## Sequence
PR #426 (foundation) → PR #427 (Sentinel decision flow) → this ingestion *contract* → separately reviewed authenticated collector and storage → verified Command Center and client alerts.

Zero mandatory paid licenses; self-host infrastructure still needs cost and capacity assessment.
