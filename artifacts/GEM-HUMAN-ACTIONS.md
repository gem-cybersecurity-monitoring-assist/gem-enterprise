# GEM Human Approval Register

Reconciled `2026-08-10T22:06:45Z` in `CODEX_CLOUD` using GitHub PR #291 head `9db0e5d3240bc529de8fcffad6080219214646bc` and local artifact commit `c54c0f0ddabb24a5f8d303efb4c3d5ba0ca9a742`. An action is not repeated after satisfaction; credentials, tokens, personal data, and secret values must never be recorded here.

## HA-001 — Repository and PR read evidence

- **State:** SATISFIED
- **Reason:** Current external live evidence establishes draft PR #291, its exact GitHub head/base relationship, passing-status count, and review-thread state.
- **Exact component:** Draft PR #291 in `support371/gem-enterprise`.
- **Actual evidence:** Head `9db0e5d3240bc529de8fcffad6080219214646bc`; base `main` at `1128771e2b8dfc767fb50a7394dee4b5de5a8544`; 1 ahead/0 behind; 11 passing statuses; no unresolved review thread.
- **What Codex already proved:** PR read authorization is no longer requested. The local `work` branch and local artifact commit are not represented as the authoritative GitHub PR branch/head.
- **What Codex must do after satisfaction:** Do not request this approval again. Recheck live PR evidence only when a later session needs freshness.

## HA-001B — Existing PR #291 branch publication

- **State:** OPEN
- **Reason:** This workspace has no Git remote, so the final reconciliation commit cannot be published to the existing PR branch here.
- **Exact component:** Existing draft PR #291 only; creating another PR is prohibited.
- **Required evidence:** Successful publication of this exact four-file reconciliation to the existing PR #291 branch and verification of the resulting GitHub head.
- **What Codex already proved:** The final patch is limited to the four existing artifacts.
- **What Codex must do after approval:** Push only to the existing PR #291 branch, record the verified resulting head, and do not merge.

## HA-002 — Canonical Vercel preview verification

- **State:** OPEN
- **Reason:** GitHub PR read evidence is satisfied, but only the canonical Vercel Git integration can provide preview identity and logs; no second production deployment is authorized.
- **Exact component:** Vercel project `support371-gem-enterprise` for PR #291.
- **Required evidence:** Canonical preview identifier, exact commit SHA, successful preview verification/build logs, affected-route checks, and previous valid deployment identifier.
- **What Codex already proved:** Repository-side protected configuration did not drift and no duplicate deployment was initiated.
- **What Codex must do after approval:** Inspect authorized preview evidence, bind it to the exact commit, run non-destructive smoke checks, and update the ledger without deploying production.

## HA-003 — Production database ownership and migration-state confirmation

- **State:** OPEN
- **Reason:** Production database access and migration execution are owner-controlled and must not be mutated from CI.
- **Exact component:** PostgreSQL/Prisma production persistence.
- **Required evidence:** Accountable owner, sanitized migration status, compatibility assessment, readable backup/restore evidence, migration-specific rollback implications, and explicit execution approval if needed.
- **What Codex already proved:** 32 migration files and the unchanged schema hash exist; no database was mutated. Both required database environment-variable names are absent in this process.
- **What Codex must do after approval:** Compare authorized migration state and run safe compatibility and repeated request checks without promoting persistence based only on repository files.

## HA-004 — GEM Studio Windows runtime and real-call acceptance

- **State:** OPEN
- **Reason:** `CODEX_CLOUD` cannot inspect Windows-local media state, while actual visual/audio acceptance requires a consented human.
- **Exact component:** GEM controller, Pinokio/Decart, OBS/WebSocket/Virtual Camera, Voicemod, and real call flow.
- **Required evidence:** Positive `GEM_ASSIST_WINDOWS` classification; protected configuration hashes; resource and controller security results; bounded soak log; process/listener ownership; recovery behavior; consented visual/audio acceptance.
- **What Codex already proved:** No Windows or media readiness claim was made and no Windows mutation occurred.
- **What Codex must do after approval:** Baseline before mutation, run the controller security matrix, observe sustained readiness, distinguish network from dependency failure, and record human acceptance separately.

## HA-005 — News Forge content and publication approval

- **State:** OPEN
- **Reason:** Story rights, identity/consent, speech acceptance, and publication are governance decisions.
- **Exact component:** News Forge story-to-speech/publication flow.
- **Required evidence:** Owner-approved story, rights and identity/consent confirmation, controlled speech E2E result, and explicit publication approval.
- **What Codex already proved:** Nothing was activated and the dependency remains `HUMAN_REQUIRED`.
- **What Codex must do after approval:** After security and preview prerequisites pass, run one controlled E2E test and keep automatic publication disabled absent separate approval.

## HA-006 — Notion provider consent and controlled publication

- **State:** OPEN
- **Reason:** Provider consent, publication identity, and approval cannot be inferred.
- **Exact component:** Notion integration and publication target.
- **Required evidence:** Owner-granted consent, approved secret storage, negative publication test, one positive controlled-record test, identity/consent approval, and explicit publication approval.
- **What Codex already proved:** No provider credential or secret value was inspected, logged, or activated.
- **What Codex must do after approval:** Prove rejection before success, constrain scope, retain sanitized evidence, and preserve credential-revocation rollback.

## HA-007 — Release-candidate ownership and freeze approval

- **State:** OPEN
- **Reason:** Release approval cannot precede automated, cloud, local runtime, security, rollback, provider, and governance evidence.
- **Exact component:** Final GEM evidence dossier and release-candidate freeze.
- **Required evidence:** Exact repository/branch/commit, package version, build hash, deployment artifact, controller package SHA-256, complete evidence directory, rollback validation, and owner sign-off.
- **What Codex already proved:** Current evidence supports `NO-GO`; no candidate, production deployment, or activation was declared.
- **What Codex must do after approval:** Freeze only after prerequisites pass; any release-blocking fix creates a new candidate and reruns affected tests.
