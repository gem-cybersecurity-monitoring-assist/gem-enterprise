# Sentinel Panther command-center companion

Sentinel Panther is GEM Enterprise's governed operator companion. It converts session context into deterministic lifecycle, safety, evidence, and animation decisions. It does not execute external actions.

## Runtime boundary

- `src/lib/sentinel-panther/contract.ts` is the canonical typed identity, vertical, state, motion, and crypto safety contract.
- `src/lib/sentinel-panther/runtime.ts` is a pure, deterministic policy evaluator.
- `POST /api/command-center/sentinel-panther` is restricted to the existing platform-owner session gate, validates input with Zod, returns no-store responses, and records the decision through the existing audit boundary when auditing is enabled.
- Denied requests return HTTP 422 with an exact decision code. Authentication and validation failures use the existing shared API responses.

## Evidence rule

`COMPLETE_EVIDENCED` is allowed only from `VERIFYING`, with at least one non-empty evidence reference, at least one check, and every check confirmed. A failed or pending check keeps the prior state and selects the failure animation.

## Crypto safety posture

The current crypto context is pinned to `support371/crypto-signal-bot` on `feat/regulated-live-foundation`. Only paper mode is allowed. Mainnet, live orders, withdrawals, real-fund movement, and external execution fail closed.

## Persistence gate

This vertical slice is intentionally stateless. Durable Sentinel sessions require an additive Prisma model, migration rehearsal against a disposable PostgreSQL database, rollback evidence, and explicit approval before any production migration. Until then, the caller remains responsible for retaining the last allowed state and evidence references.

## Rollback

Remove the Sentinel route, shared module, test file, and this document. No schema, environment, provider, billing, deployment, or production data change is involved.
