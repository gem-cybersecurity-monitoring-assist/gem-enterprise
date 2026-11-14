# Shared social account connection repair
Owner: ChatGPT Work, 2026-11-14. Base: 25f9699331a9e11eedb0256a2f7057722630a20d. Branch: fix/shared-social-database.
Scope: existing OAuth start/callback and connector read/disconnect and read-only test/credential-health routes; account, nonce and credential stores; accounts page and readiness; tests. Use the verified project-bound social client. No global database changes, schema writes, publishing activation, automatic grants, other projects or paid services.
Separate authorization configuration from publishing approval; existing publishing validation stays strict. Meta app 1658172452359921 is development/unpublished and review is not submitted. Provider grant/discovery, encrypted persistence and fresh readback are required to claim connected.
Verification: scoped database, revoked session/membership, single-use state, redaction and publishing-approval regression tests; full verify and exact-head hosted checks. Rollback: revert this repair.
