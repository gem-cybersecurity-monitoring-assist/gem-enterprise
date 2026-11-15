# P0 Core workspace gateway / Prisma readiness — Issue #508

Branch: \`fix/core-prisma-readiness-508\` on canonical
\`gem-cybersecurity-monitoring-assist/gem-enterprise\`; base main
\`79caeb3f08ba333da613f8268b2480cba2c3a3eb\`.
Owner: ChatGPT Work. Draft PR #509, production unchanged.

Problem: the original production platform uses Supabase gateway authentication
but legacy generic Prisma workspace/Command Center reads may run without a
configured core connection. A passing gateway bootstrap does not authorize
arbitrary transactional reads.

Implementation:
- Preserve the existing session/account active authorization for
  \`GET /api/workspaces\`.
- For \`supabase_gateway\` sessions, use the same \`getGatewaySessionToken\`
  and \`workspaceGateway("access")\` already used by \`/app/workspace\`;
  its server-side active membership scoping remains authoritative. Validate
  the response, reject duplicate/malformed/negative-count records, and emit
  only explicit workspace dashboard fields (no unexpected gateway fields).
  A requested workspace outside the returned membership set receives 403.
  Missing tokens or gateway failures receive a controlled 503 with no Prisma
  fallback.
- Preserve local sessions' current Prisma-backed workspace membership logic
  when any supported core URL alias is configured; return controlled 503
  without attempting Prisma if it is absent.
- When the generic core URL is absent, return disclosed unavailable/null
  Command Center aggregate metrics without invoking Prisma. Existing
  dedicated administrator gateway statistics remain a separate read-only
  partial fallback in the SaaS UI.
- Never copy \`GEM_SOCIAL_POSTGRES_PRISMA_URL\` or other scoped social
  credentials into a generic Prisma connection.

Tests: successful authorized gateway account, specific workspace membership,
cross-tenant 403, no/invalid/duplicate gateway results, fail-closed gateway
outage, absent session token, private data redaction, inactive/unauthorized
session, all supported legacy core URL aliases, configured direct query,
no-DB-I/O missing backend and no false live metrics.

No secrets entered or decrypted, migrations, provider permissions, billing,
paid services, posting, external writes, or production release.

Acceptance: GitHub exact-head test/lint/typecheck/build and tracked-secret
scan, canonical Vercel preview READY, independent review, and read-only
owner-authenticated production acceptance *after* approved release. Passing
code tests alone does not prove actual gateway membership shape or live
session acceptance. Generic Command Center transactional data readiness,
migration and backups remain tracked in #259. Rollback: revert focused PR.

Status: IMPLEMENTED IN DRAFT. Hosted exact-head checks and preview must be
rechecked after the final sanitization commit. No production release claimed.
