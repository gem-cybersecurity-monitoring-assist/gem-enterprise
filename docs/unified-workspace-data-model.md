# Unified Client Workspace OS — Data Model (WS-F)

Owner: workstream WS-F (data model). Scope: `prisma/schema.prisma`,
`prisma/migrations/20260929120000_unified_client_workspace_os/`, this document.

Guiding rules for every decision below:

1. **Reuse first.** The schema already has 55 models; a new table must earn its
   place — it is added only where no existing model can represent the domain.
2. **Additive-only.** No existing table, column, enum, or index was altered and
   no existing schema line was modified. The two new models needed
   back-reference fields on `Workspace`/`User`/`Organization` (Prisma rejects
   relations without an opposite field — proven by the validator); those were
   added as new lines only, placed away from every promotion-script anchor, so
   `pnpm run db:schema:check` keeps passing.
3. **New models carry**: tenant/org ownership, a workspace relation where the
   concept is workspace-scoped, `createdAt`/`updatedAt`, a status field, a
   responsible actor, and audit/retention notes.

---

## Decision (a) — Client unified timeline: reuse `DomainEvent`, no new model

**Verdict: `DomainEvent` serves as the timeline event store. No new model.**

`DomainEvent` (`tokmetric_domain_events`) is already the workspace-scoped,
append-only event store: `workspaceId`, `aggregateType`, `aggregateId`,
`eventType`, `correlationId`, `safeMetadata` (JSONB, PII-safe by convention),
`createdAt`, with indexes on `(workspaceId, aggregateType, aggregateId)` and
`(correlationId)`. That is exactly the shape a unified timeline needs:
per-workspace, ordered, correlatable, and cheap to query for "everything that
happened in this workspace, newest first".

A timeline is a **read-side projection** over these events, not a second
write-side store. Duplicating events into a dedicated `TimelineEntry` table
would create a dual-write consistency problem for zero new information.

### Conventions to use (mandatory for timeline writers)

| Field | Convention |
|---|---|
| `aggregateType` | lowercase snake-case domain noun: `service_request`, `intake_submission`, `support_ticket`, `support_session`, `notification`, `meeting_request`, `approval_request`, `compliance_review`, `connector`, `organization_project`, `workspace`, `message`, `email`, `kyc_application`, `entitlement` |
| `aggregateId` | the primary key of the aggregate row (e.g. `ServiceRequest.id`) |
| `eventType` | SCREAMING_SNAKE (dominant existing convention, e.g. `AGENT_RUN_COMPLETED`, `CONTENT_VERSION_CREATED`); one legacy outlier `support_message` exists and is grandfathered |
| `correlationId` | stable id tying a causal chain (e.g. intake → service request → approval); reuse across aggregates |
| `safeMetadata` | must include `occurredAt` (ISO-8601 source time; `createdAt` is record time), `actorId` (who caused it; `DomainEvent` has no first-class actor column), `audience` (`client` \| `internal` \| `staff`) for timeline visibility filtering, and a short human `title`/`summary` for rendering |

### Mandate §3 event families → aggregate/event mapping

| Family | `aggregateType` | Example `eventType`s |
|---|---|---|
| Web milestones | `organization_project` / `workspace` | `MILESTONE_REACHED`, `PROJECT_STATUS_CHANGED` |
| Forms / intake | `intake_submission` | `INTAKE_SUBMITTED`, `INTAKE_STATUS_CHANGED`, `INTAKE_CONVERTED` |
| Chat / messages | `support_session` / `message` | `support_message`, `CHAT_ESCALATED` |
| Email | `email` | `EMAIL_SENT`, `EMAIL_CAMPAIGN_SENT` |
| Support | `support_ticket` / `support_session` | `TICKET_CREATED`, `TICKET_STATUS_CHANGED`, `SUPPORT_BOOKING_CONFIRMED` |
| Appointments | `meeting_request` | `MEETING_REQUESTED`, `MEETING_CONFIRMED`, `MEETING_COMPLETED` |
| Requests | `service_request` | `SERVICE_REQUEST_CREATED`, `SERVICE_REQUEST_STATUS_CHANGED`, `SERVICE_REQUEST_ASSIGNED` |
| Project / financial | `organization_project` | `WEEKLY_UPDATE_SUBMITTED`, `PROJECT_STATUS_CHANGED` |
| Compliance / security | `compliance_review` / `kyc_application` | `COMPLIANCE_REVIEW_COMPLETED`, `KYC_STATUS_CHANGED`, `SECURITY_EVENT` |
| Approvals | `approval_request` | `APPROVAL_REQUESTED`, `APPROVAL_DECIDED` |
| Notifications | `notification` | `NOTIFICATION_SENT` |
| Integrations | `connector` | `CONNECTOR_CONNECTED`, `CONNECTOR_HEALTH_CHECK_FAILED`, `CONNECTOR_SYNC_COMPLETED` (see decision (d)) |

Known gaps (accepted, carried by convention rather than schema): `DomainEvent`
has no first-class `actorId`, `occurredAt`, or visibility column — all three
live in `safeMetadata` per the table above. If timeline queries ever need
indexed actor/visibility filtering at scale, the escape hatch is additive
nullable columns, not a new table.

---

## Decision (b) — Service-request activity/status history: reuse `AuditLog`, no new model

**Verdict: `AuditLog` with `resource = "service_request"` is sufficient. No new model.**

The pattern is already established in `src/lib/serviceRequests.ts` (creation
path): `AuditLog` rows are written with `action: "case_created"`,
`resource: "service_request"`, `resourceId: <request id>`, and rich
`metadata` (`type`, `subject`, `priority`, `scope`, `workspaceId`,
`organizationId`, …). WS-E's transitions/assignments follow the same row shape:

| Write | `action` | `metadata` additions |
|---|---|---|
| Creation | `case_created` | as today |
| Status transition | `admin_action` (`case_closed` when the new status is `completed`/`cancelled`) | `fromStatus`, `toStatus`, `reason`, `workspaceId` |
| Assignment / reassignment | `admin_action` | `assignedTo` (user id), `previousAssignee`, `workspaceId` |

Rationale for not adding a dedicated `ServiceRequestStatusEvent` table: the
current `ServiceRequest.status` is the source of truth; `AuditLog` supplies
who/when/what/why; the `IntakeStatusEvent` precedent exists because intake
transitions run through a privileged stored procedure with optimistic
concurrency — service requests have no such mechanism to mirror. A dedicated
table would duplicate audit data without new query capability.

Notes:

- `AuditAction` is a closed enum; **no new enum values are added** (an enum
  change would need a migration for marginal semantic gain — `metadata`
  carries the precise transition). This is a deliberate documenting-over-
  changing call.
- `AuditLog` is user-scoped, not workspace-scoped (workspace travels in
  `metadata`). For workspace-scoped audit queries, `AuditEvent`
  (`tokmetric_audit_events`: `workspaceId`, free-text `action`, `entityType`,
  `entityId`, `actorId`, `correlationId`, `outcome`) is the sibling store —
  either satisfies the audit requirement; `AuditLog` is chosen here because
  the service-request code path already writes to it.

---

## Decision (c) — Capability readiness overrides: NEW model `CapabilityReadinessOverride`

**Verdict: no existing model fits — added.**

`Workspace` carries coarse kill-switches (`globalEmergencyLock`,
`connectorDisabled`, `publishingDisabled`, `advertisingDisabled`,
`shopWriteDisabled`) — module-agnostic booleans, not per-module readiness
states. Nothing in the schema can hold an admin-set
`(workspace, module) → CapabilityState` override, so the minimal model from the
mandate is added (back-references added as new lines only, anchor-safe):

```prisma
model CapabilityReadinessOverride {
  id          String   @id @default(cuid())
  workspaceId String                                   // tenant scope via Workspace → Organization
  moduleId    String                                   // stable module slug, owned by the capability registry (mandate §4)
  state       String   @default("UNAVAILABLE")         // CapabilityState value; SQL CHECK enforces the 9 values
  reason      String?                                  // why the override was set
  setById     String?                                  // responsible actor (FK User, SetNull)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  setBy     User?     @relation(fields: [setById], references: [id], onDelete: SetNull)

  @@unique([workspaceId, moduleId])
  @@index([workspaceId])
  @@map("capability_readiness_overrides")
}
```

- `state` is `String`, not a Prisma enum: `CapabilityState` is a TypeScript
  union owned by `src/lib/capabilityReadiness.ts`
  (`LIVE`, `SURFACE_AVAILABLE`, `SETUP_REQUIRED`, `PROVIDER_NOT_CONFIGURED`,
  `AUTHORIZATION_REQUIRED`, `NOT_ENTITLED`, `RESTRICTED`, `DEGRADED`,
  `UNAVAILABLE`); the migration's `CHECK` constraint enforces exactly these 9.
  Default `UNAVAILABLE` is fail-closed.
- `moduleId` format: lowercase snake slug (e.g. `support_chat`,
  `client_portal`); the authoritative module registry lives with the mandate §4
  owner — this table stores overrides, not the registry.
- Back-references (required by Prisma; added as new lines only, anchor-safe):
  `Workspace.capabilityReadinessOverrides`,
  `User.setCapabilityReadinessOverrides`.
- Semantics: last-writer-wins current state (upsert on
  `(workspaceId, moduleId)`). Resolution order in
  `resolveCapabilityState` stays computed-first; an override, when present,
  replaces the computed state and must surface `reason` in the UI.
- **Audit/retention:** every set/change/delete writes an `AuditEvent`
  (`entityType: "capability_readiness_override"`, `entityId: <id>`,
  `action: "capability_readiness_override_set"`, `actorId: setById`,
  `safeMetadata: { moduleId, oldState, newState, reason }`). No separate
  history table — history is the audit trail. No PII beyond user ids; no
  scheduled purge needed (row count bounded by workspaces × modules).

---

## Decision (d) — Integration/provider registry health: document, no schema change

**Verdict: `Connector` + `TokMetricConnectorState` cover the registry; document
mappings instead of changing the enum or widening the table.**

Enum coverage (read from the schema):

| Mandate state | Coverage |
|---|---|
| `NOT_CONFIGURED` | ✅ enum value (also the column default) |
| `CONNECTED` | ✅ enum value |
| `DEGRADED` | ✅ enum value |
| `DISABLED` | ⚠️ **not** an enum value — represented by `Connector.disabledAt IS NOT NULL`. Convention: disabling sets `disabledAt` (and should also move `state` to `DISCONNECTED` so the enum stays truthful); re-enabling clears `disabledAt`. Do **not** add a `DISABLED` enum value — Postgres enum changes are migration-risky for zero new information. |

Health-panel field mapping:

| Mandate field | Source |
|---|---|
| provider | `Connector.provider` (`TokMetricConnectorProvider`) |
| service | derived from `provider` (each provider enum value names its service surface) |
| state | `Connector.state` + `disabledAt` convention above |
| scopes | `Connector.grantedScopes` |
| health | `Connector.state` ∈ health-bearing values (`DEGRADED`, `TOKEN_EXPIRED`, `REAUTHORIZATION_REQUIRED`, …) + `lastHealthAt` recency |
| last sync | latest `DomainEvent` (`aggregateType: "connector"`, `aggregateId: <connector id>`, `eventType: "CONNECTOR_SYNC_COMPLETED"`, `safeMetadata.syncedAt`) |
| errors | latest `DomainEvent` (`eventType: "CONNECTOR_HEALTH_CHECK_FAILED"` / `"CONNECTOR_SYNC_FAILED"`, `safeMetadata: { errorCode, errorDetail, consecutiveFailures }`) |
| remediation | `DomainEvent` (`eventType: "CONNECTOR_REMEDIATION_STARTED"` / `"CONNECTOR_REMEDIATION_COMPLETED"`, `safeMetadata: { action, actorId }`) |
| audit | `AuditEvent` / `DomainEvent` per decisions (a)/(b) |

Rationale for not widening `Connector` with `lastSyncAt`/`lastError`/
`errorCount` columns: the event store already answers "what is the latest
sync/error/remediation for this connector" via the
`(workspaceId, aggregateType, aggregateId)` index, and duplicating that into
columns creates a write-amplification / staleness problem on every health
probe. Escape hatch (additive, safe): if read pressure ever justifies it, add
nullable `lastSyncAt`/`lastError`/`consecutiveFailures` columns in a later
migration — no backfill required.

---

## Decision (e) — Customer lifecycle stage: NEW model `LifecycleFunnelState`

**Verdict: no existing representation fits — added (smallest possible).**

Naming note: the model is `LifecycleFunnelState` (table
`lifecycle_funnel_states`), deliberately *not* `CustomerLifecycleState` —
that name is already taken by the `CustomerLifecycleState` type in
`src/lib/customer-success/contracts.ts` (the per-workspace post-sale health
axis `ACTIVE`/`AT_RISK`/`PAUSED`/`COMPLETED`/`DORMANT` used by the
customer-success admin UI). Reusing it for the Prisma model would create a
`Prisma.LifecycleFunnelState`-vs-type near-collision.

Checked and rejected:

- `Organization.status` — a free-text **access gate** (`"active"`), enforced in
  `src/lib/organizationWorkspace.ts` (`organization.status !== "active"` denies
  access). Overloading it with funnel stages (`visitor`, `lead`, …) would
  corrupt access control. Not reusable.
- `CustomerSuccessProfile.lifecycleState` (materialized by
  `scripts/apply-customer-success-prisma.mjs`) — per-**workspace**, post-sale
  health axis (`ACTIVE`/`AT_RISK`/`PAUSED`/`COMPLETED`/`DORMANT`), not the
  org-level acquisition funnel. Different grain, different axis.
- `Profile` — per-user identity record; the lifecycle subject is the customer
  **organization**, not an individual user.

Added model (org-level; no workspace relation — the funnel stage belongs to the
tenant, above workspaces):

```prisma
model LifecycleFunnelState {
  id             String   @id @default(cuid())
  organizationId String   @unique                          // the tenant; one row per org
  stage          String   @default("LEAD")                 // funnel stage; SQL CHECK enforces the list below
  reason         String?                                  // why the stage changed
  changedById    String?                                  // responsible actor (FK User, SetNull)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  changedBy    User?        @relation(fields: [changedById], references: [id], onDelete: SetNull)

  @@map("lifecycle_funnel_states")
}
```

Canonical `stage` values (enforced by the migration `CHECK`):
`VISITOR → LEAD → QUALIFIED → ONBOARDING → ACTIVE → EXPANSION`,
plus terminal/divergent `AT_RISK`, `CHURNED`, `DORMANT`.

- Pre-organization stages: `VISITOR`/`LEAD` exist before an `Organization` row
  does — they are **derived** from `IntakeSubmission` (`kind`/`status`), not
  stored here. A `LifecycleFunnelState` row is created at (or after)
  `QUALIFIED`/org creation; `stage` default `LEAD` covers orgs created without
  an explicit transition.
- Transitions should move monotonically forward along the funnel; regressions
  (`ACTIVE → LEAD`) require `reason` and are audit-flagged, not blocked.
- Back-references (required by Prisma; added as new lines only, anchor-safe):
  `Organization.lifecycleFunnelState`, `User.changedLifecycleFunnelStates`.
- **Audit/retention:** every change writes an `AuditEvent`
  (`entityType: "lifecycle_funnel_state"`, `action: "lifecycle_stage_changed"`,
  `actorId: changedById`, `safeMetadata: { oldStage, newStage, reason }`).
  One row per org (upsert); history lives in the audit trail. No PII beyond
  user/org ids; no purge needed.

---

## Migration

`prisma/migrations/20260929120000_unified_client_workspace_os/migration.sql`
(PostgreSQL, idempotent-style):

- `CREATE TABLE IF NOT EXISTS` for both tables, with `CHECK` constraints on
  `state` (9 `CapabilityState` values) and `stage` (9 funnel values).
- `CREATE [UNIQUE] INDEX IF NOT EXISTS` for `@@unique([workspaceId, moduleId])`,
  `@@index([workspaceId])`, and the `organizationId` unique key.
- FKs added via guarded `DO` blocks (`pg_constraint` existence check):
  `workspaceId → tokmetric_workspaces (CASCADE)`,
  `organizationId → tokmetric_organizations (CASCADE)`,
  `setById`/`changedById → users (SET NULL)`.
- `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM anon, authenticated` on both
  tables, matching repo convention.
- **Not run against any database** (per mandate); to be applied by the normal
  migration pipeline with owner approval.

## Validation

- `pnpm exec prisma validate` — **cannot bootstrap in this sandbox**
  (environmental, unrelated to the schema): the prisma 5.22.0 CLI's internal
  HTTP client crashes with an uncaught `ECONNRESET` on TLS through the sandbox
  egress proxy before reading any schema — `prisma --version` crashes
  identically. This matches the known sandbox limitation noted in `AGENTS.md`
  (`prisma generate` hits the same wall).
- **Equivalent validation performed instead**: drove the exact WASM validator
  the CLI uses (`prisma_schema_build_bg.wasm`, the same `lint` + `validate`
  calls `prisma validate` makes, with identical `{prismaSchema, noColor}`
  params) directly over its exported functions, bypassing only the broken CLI
  bootstrap. Result: **0 lint diagnostics, `VALIDATE: OK — the schema is valid`**.
  This pass caught and fixed a real defect first (missing back-references —
  see rule 2), proving it exercises the same checks.
- `pnpm run db:schema:check` — **all five marker promotion checks pass**
  (exit 0), proving the append and the back-reference lines broke no
  `scripts/apply-*-prisma.mjs` anchors.

## Follow-ups for other workstreams (not WS-F scope)

- WS-E: write service-request transitions/assignments to `AuditLog` using the
  `resource`/`metadata` conventions in decision (b).
- Timeline UI owner: build the read projection over `DomainEvent` using the
  conventions in decision (a); enforce `safeMetadata.audience` filtering.
- Mandate §4 owner: publish the authoritative `moduleId` registry consumed by
  `CapabilityReadinessOverride`.
- Drift note (informational): `customer_success_*` tables exist in migration
  SQL but their Prisma models only materialize via
  `scripts/apply-customer-success-prisma.mjs` — the working-copy schema does
  not contain them until promotion. Not WS-F's to fix; flagged so timeline /
  lifecycle writers know which store is canonical where.

## Audit decision summary

| Item | Decision | Schema change |
|---|---|---|
| (a) Unified timeline | Reuse `DomainEvent` + conventions | none |
| (b) Service-request history | Reuse `AuditLog` (`resource="service_request"`) + conventions | none |
| (c) Capability readiness overrides | New `CapabilityReadinessOverride` | ✅ table `capability_readiness_overrides` |
| (d) Provider registry health | Document enum/field mappings | none |
| (e) Customer lifecycle stage | New `LifecycleFunnelState` | ✅ table `lifecycle_funnel_states` |
