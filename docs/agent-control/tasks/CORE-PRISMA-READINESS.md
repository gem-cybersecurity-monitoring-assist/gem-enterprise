# P0 Core Prisma readiness — Issue #508

Branch: `fix/core-prisma-readiness-508`, base `79caeb3f08ba333da613f8268b2480cba2c3a3eb`.
Owner: ChatGPT Work, canonical GEM Enterprise production source.

Problem: in Supabase gateway mode the generic Prisma URL is not configured,
but some existing workspace and Command Center reads still call Prisma.
A passing gateway bootstrap does not certify those transactional reads.

Scope: align a new read-only core database configuration predicate with the
aliases in `src/lib/db.ts`. After existing session/account authorization, the
workspace API returns 503 without a generic backend, before membership reads.
The Command Center snapshot returns disclosed unavailable metrics without
attempting privileged queries. Keep existing configured paths unchanged.

Trust boundary: never use or copy `GEM_SOCIAL_POSTGRES_PRISMA_URL` as
a generic connection; no provider secret, no credentials, migration, schema,
publish action, or configuration mutation. No sample counts or false
success. Tests cover alias selection, missing URL, no DB I/O, denied session,
and successful configured-path behavior.

Live follow-up: the real solution remains an approved tenant-scoped
transaction gateway or a separately reviewed core data connection, owner
authenticated acceptance, and an operating-layer/backup check in #259.
No claim of functional core workspace reads merely from a passing unit test.
Rollback: revert this focused source PR. Local tests not runnable in this
ChatGPT container (private Git repository and package registry unavailable);
require exact-head GitHub/Vercel hosted checks and an independent review before
merge. Status: IMPLEMENTED IN DRAFT; GATES PENDING.
