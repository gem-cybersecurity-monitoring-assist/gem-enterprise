# Meta destination verification

Owner: ChatGPT Work. Base: `8b387137f802142d4ca6fd1f3615c9b2cf14c8b6`.
Branch: `fix/meta-account-probes`.

The Instagram connector's existing probe calls `/me` using its linked Page token,
so it reports Page connectivity rather than verifying the saved Instagram account.
Probe the exact persisted destination, require the returned ID to match, and show
live account-check evidence separately from unknown token expiry.

Acceptance: Instagram uses its saved ID and username fields; Page probes retain
their saved identity; missing/malformed IDs, mismatches and provider errors fail
closed; tokens remain server-only; the existing health button performs and records
a read-only probe; publishing and platform-review gates remain unchanged.

Scope: probes, health/test route wiring, connector panel, tests and task records.
No schema, credentials, authorization grants, billing or unrelated project changes.
Verification: focused regression tests, full `pnpm verify`, exact-head CI and canonical
preview, followed by production read-only probes. Rollback: revert this repair.

Tracking: #493. Local validation on Node 24.22.1 / pnpm 10.28.0:
- Prisma schema consistency and generated public claims report: passed.
- ESLint and TypeScript: passed.
- Vitest: 218 files, 1469 tests passed.
- Next.js production build: passed using CI placeholders, no live credentials.
- `pnpm verify` itself stops because the tsx CLI cannot listen on its temporary
  Unix IPC socket in this runtime (EPERM). The identical claims-report script
  passed via `node --import tsx scripts/generate-public-claims-report.ts --check`,
  followed by the remaining verify components in their original order.
- Generated next-env.d.ts build output restored; lockfile unchanged.
- Exact-head hosted gates, independent review and live probes remain pending.
