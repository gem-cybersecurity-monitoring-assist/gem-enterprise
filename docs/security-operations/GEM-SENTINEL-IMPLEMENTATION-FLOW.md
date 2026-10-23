# GEM Sentinel — controlled integration flow

Status: **local decision foundation committed in a dependent branch**. This does **not** mean live protection is active.

## Architecture
Authorized device / cloud identity / approved network telemetry
→ authenticated collector (not implemented)
→ validated immutable tenant scope and normalized alert
→ deduplication and persisted case store (not implemented)
→ GEM Sentinel deterministic triage (implemented as pure library)
→ operator review and consent
→ separate downstream action authorization (not implemented)
→ Command Center plus redacted Telegram alert (not implemented)
→ outcome verification, audit and recovery.

## Existing system reconciliation
- The Workspace OS Sentinel UI is an existing governed monitoring surface, **not proof of endpoint telemetry**.
- Sentinel Panther PR #228 is a separate operator-companion concept and includes crypto references; do not blend it into GEM cybersecurity or change its files.
- PR #426 is the prerequisite for this flow, with the security-event normalization and fail-closed response policy.
- PR #425 is an independent browser-extension pilot with no VPN or breach provider operational.
- Command Center security datasets on main explicitly declare `not_configured`; do not replace with synthetic incident counts.

## Source and tenancy gates
1. Explicit customer agreement identifies enrolled assets, logs, retention, access purposes and response authority.
2. An operator registers the connector server-side. No user-controlled tenant ID can set authorization.
3. Collector authenticates the source, rate-limits traffic, constrains payload size, rejects replay, validates signatures/tokens and checks schema.
4. Raw evidence uses encrypted storage with per-tenant access and bounded retention; generated case IDs do not grant access.
5. Alert-to-case workflow is idempotent by tenant + source + event ID, with a durable uniqueness constraint.
6. Only verified persisted data appears in customer/security surfaces.

## Action gates
- Observe-only until separately enabled and tested.
- Credential/token storage belongs in approved secrets service, never source/PR logs.
- Protective actions must undergo authenticated role checks, exact-target verification, time-limited human approval, policy evaluation, replay protection, audit receipt and rollback, all enforced again by the executor.
- Telegram messages are redacted; sensitive evidence remains behind authenticated GEM portal links.
- Banking accounts must use authorized read-only/provider-supported APIs; no implied freeze, encryption or transaction control.

## Free-first installation order
1. Build and test this library and PR #426; no provisioning needed.
2. Measure a **single authorized lab endpoint** with self-hosted Wazuh, or reuse an existing host that passes resource and data-protection checks.
3. Validate source → collector → durable case → Command Center using lab data explicitly identified as test data.
4. Wire operator review and Telegram only after credentials, scopes, secret scanning and access controls pass.
5. Add Suricata, osquery, Trivy and cloud posture modules one at a time, each with rollback and operational cost controls.
6. Publish signed onboarding instructions and an operational readiness checklist before production client enrollment.

## Acceptance
- Fail closed for missing tenant identity, unsupported source and invalid alert.
- No cross-tenant access even with colliding source event IDs.
- Duplicate events produce a single persisted case (not yet implemented).
- Client consent and human approval are verified, logged and expire.
- Ingestion availability, detection latency, backup restore, recovery and alert quality are measured.
- No unsupported live data, government endorsement or guaranteed protection claims.

## Dependency & release
**Dependency order:** PR #426 → GEM Sentinel flow → collector/persistence PR → client surfaces/integration PR.
Leave all as draft/unmerged until exact-head tests and review pass. Do not activate paid plans, change production auth/Prisma, or deploy.
