# GEM Rollback Register

Reconciled `2026-08-10T22:06:45Z` against main `1128771e2b8dfc767fb50a7394dee4b5de5a8544`, supplied GitHub PR #291 head `9db0e5d3240bc529de8fcffad6080219214646bc`, and local artifact commit `c54c0f0ddabb24a5f8d303efb4c3d5ba0ca9a742`. Protected repository files are unchanged from parent baseline `1128771e2b8dfc767fb50a7394dee4b5de5a8544`.

Rollback documentation is not rehearsal evidence. Each entry identifies the current safe point and the proof still required. Destructive production rehearsal is prohibited.

## RB-001 — Persistent ledger documents

- **Scope:** The four files under `artifacts/` represented on GitHub by supplied PR head `9db0e5d3240bc529de8fcffad6080219214646bc` and locally by commit `c54c0f0ddabb24a5f8d303efb4c3d5ba0ca9a742` and updated in place by reconciliation.
- **Rollback point:** Parent commit `1128771e2b8dfc767fb50a7394dee4b5de5a8544`.
- **Method:** Revert the ledger delivery commit on its focused branch; do not delete unrelated artifacts.
- **Data/runtime impact:** None; documentation-only change.
- **Validation:** Confirm the revert touches only these four files and run `git diff --check` plus the repository verification gate.
- **Rehearsal:** Non-destructive validation confirmed the parent commit exists and the artifact commit changes only the four ledger files; an actual revert was not performed.
- **Status:** Readable and actionable.

## RB-002 — Application deployment

- **Scope:** Canonical Vercel application deployment.
- **Rollback point:** `HUMAN_REQUIRED` — the previous real deployment identifier is not available in this session.
- **Method:** An authorized owner selects the previously verified deployment through the canonical Vercel project workflow; never run a duplicate `vercel --prod` workflow.
- **Data/runtime impact:** Application binaries/routes only unless a release includes a separately approved database migration.
- **Validation:** Match deployment identifier to repository SHA, verify rollback controls without executing a destructive production rollback, then perform non-sensitive smoke checks if rollback is invoked.
- **Rehearsal:** Not performed; authorization and a real prior artifact are missing.
- **Failure class:** `AUTHORIZATION`.

## RB-003 — Prisma/database change

- **Scope:** Any future production schema or data migration.
- **Rollback point:** Migration-specific; no generic destructive rollback is safe.
- **Method:** Prefer forward-compatible repair. Before execution, document compatibility, backup, restore procedure, data-loss implications, and owner-approved commands referencing the exact migration and real backup artifact.
- **Data/runtime impact:** Potentially high and irreversible; never infer rollback safety from application Git history.
- **Validation:** Dry-run against an approved non-production database, validate backup readability, and record sanitized migration status.
- **Rehearsal:** Not performed because no database mutation is part of this change.
- **Failure class if missing:** `DATABASE`.

## RB-004 — GEM controller and Windows protected configuration

- **Scope:** Controller package, GEM media scripts, OBS scenes/profiles, controller configuration structure, Pinokio MAIN source, and launcher metadata.
- **Rollback point:** `BLOCKED` until a `GEM_ASSIST_WINDOWS` operator records pre-mutation hashes and a readable preserved dependency/configuration backup.
- **Method:** Stop bounded recovery, restore the exact baseline package/configuration, retain media auto-start disabled, and restart only through the documented manual path.
- **Data/runtime impact:** Local media/controller availability; do not reinstall dependencies in response to a network-only failure.
- **Validation:** Prove backup readability and restoration in a safe copy or dry-run, then compare protected hashes and investigate every unexplained difference.
- **Rehearsal:** Not performed in `CODEX_CLOUD`; no Windows mutation occurred.
- **Failure class:** `ENVIRONMENT`.

## RB-005 — Provider integrations and publication

- **Scope:** News Forge, speech provider, Notion, and any publication adapter.
- **Rollback point:** Disabled/request-only state; no production activation is approved.
- **Method:** Disable the adapter or activation flag, stop queued publication, and have an owner revoke only the dedicated provider credential through the provider secret manager when warranted.
- **Data/runtime impact:** May stop future publication but cannot retract already published content; retraction is a separate human governance action.
- **Validation:** Prove negative publication behavior before activation and again after rollback; verify secrets do not appear in logs, client bundles, or evidence.
- **Rehearsal:** Current disabled state is preserved; live credential revocation was not attempted.
- **Failure class if approval is absent:** `HUMAN_GOVERNANCE`.

## Release rollback gate

A release candidate cannot be frozen until the previous deployment identifier exists, the controller backup is readable, configuration restoration is dry-run validated, dependency backup exists, database implications are documented, and all commands reference real artifacts. Current result: **NO-GO**. No rollback point was discarded or moved during reconciliation.
