# Enterprise repository and connected-workspace audit

Owner: Codex. Source: owner mandate, 2026-10-02.
Base and current main: `7175341a328b522fdf181bf4f5ee78d6c3376f41`.
Branch: `codex/enterprise-audit-repair-20261002`.

Scope: audit Enterprise and the six connected Sites source repositories;
remove excluded Crypto Signal Bot and Certification Access listings;
repair confirmed authorization, recovery, workflow and operational-evidence gaps.
Existing work was clean and is preserved. No merge is authorized.

Owned Enterprise files: enterpriseProductRegistry.ts and its test;
platformEnvironment.ts; api/v1/platform/{environment,deployment-plan,repository}/**;
passwordResetService.ts; new enterpriseInquiryHandoff.ts and admin/intake/handoff endpoint (no mutation of existing intake lanes); new focused tests; this contract and audit report.
Read-only review of all other lanes. Do not mutate active social, advertising,
workspace OS, intake-routing or credential-scan lanes. Connected Sites each use
their own isolated repair branch after reading their local instructions.

Acceptance: anonymous and non-admin platform access denied; no invented job or
connection success; password changes roll back when session revocation cannot
be proven; excluded products absent from Enterprise registry; meaningful focused
checks and repository baseline failures separately recorded.

Rollback: revert repair commits; no live migration, account, secret or independent
crypto product changes. Preserve data and existing access grants. Production
schema execution requires a reviewed migration and rollback plan. No paid
services, outbound messages, publishing social content or financial operations.

Delivery: audit report with source heads, changed files, validation, deployment
evidence, implementation/configuration/verification/blocker distinctions.
