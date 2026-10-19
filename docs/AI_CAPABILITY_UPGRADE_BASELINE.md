# GEM AI Capability Upgrade — Baseline and Operating Contract

**Date:** 2026-10-15  
**Status:** Baseline established from repository and connected-platform metadata; runtime checks not executed in this session.  
**Scope:** Improve the reliability and throughput of build work through persistent project context, bounded implementation tasks, automated verification, and evidence-based reporting. This does not retrain the underlying AI model.

## 1. Executive baseline

GEM Enterprise already has a defined production repository and an agent-oriented delivery policy. The first improvement is therefore not to create a competing application or duplicate deployment. It is to operate within the existing control plane and make every new change small, testable, reviewable, and traceable.

### Canonical delivery identity (verified from repository documentation)

| Item | Current value |
|---|---|
| Repository | `support371/gem-enterprise` |
| Production branch | `main` |
| Hosting project | `support371-gem-enterprise` |
| Hosting | Vercel Git integration; `main` owns production deployment |
| Runtime | Node.js `24.x` |
| Package manager | `pnpm@10.28.0` |
| Application | Next.js App Router, React, TypeScript |
| Data layer | PostgreSQL via Prisma |
| Verification | `pnpm run verify` |
| Focused preview gate | `pnpm run verify:preview` |
| Primary policy | `AGENTS.md`, `docs/AGENT_BUILD_FLOW.md`, `docs/agent-control/MERGE-GATES.md` |

### Current connected-platform evidence

- The connected GitHub account can read and write the canonical repository and has repository-admin permissions.
- The Vercel project metadata identifies a recent deployment in `READY` state. Its target is not marked production, so this is not proof that the public production site is healthy or that the deployment is live.
- The Vercel project metadata reports SSO protection enabled for deployments other than custom domains. Validate access context before treating a preview URL as publicly testable.
- An existing `support371/Gem-Cybersecurity-Assist-Enterprise-` repository is separate and its README describes a different hosting arrangement. It must not be treated as the canonical application repository.
- Existing project policy explicitly prohibits duplicate production deployments, unapproved production changes, and claims of passing checks without exact-head evidence.

## 2. Evidence classification

### Verified

1. The canonical repository README names `support371/gem-enterprise`, `main`, and `support371-gem-enterprise` as the production source of truth.
2. `package.json` defines `verify` as Prisma client generation, preview verification, and production build. Preview verification includes schema checks, public-claims checks, lint, typecheck, and tests.
3. Repository policy requires isolated branches, task contracts, focused tests, exact-head evidence, preview verification, and separate human approval for high-impact changes.
4. GitHub issue [#438](https://github.com/support371/gem-enterprise/issues/438) tracks this baseline deliverable.
5. Branch `docs/ai-capability-upgrade-baseline-20261015` was created from `main` for this documentation-only change.

### Not verified in this session

- A local checkout was not provisioned; no source files were changed locally.
- `pnpm install --frozen-lockfile`, `pnpm run verify`, browser-based smoke tests, and accessibility tests have not been run here.
- No new preview deployment or production smoke test has been performed for this change.
- Current live production health, customer conversion performance, and active provider integrations have not been independently validated.
- The repository's full active-work register may contain overlapping work; refresh it and the related pull requests before any future application-file mutation.

### Assumptions (must be checked before acting)

- The canonical repository and Vercel project documented in the README remain authoritative. Reconfirm if repository or hosting metadata changes.
- Documentation-only work is the safest initial slice because it improves operating reliability without changing runtime behavior.
- Existing tests and CI/preview gates remain the acceptance mechanism until evidence supports a better one.

## 3. Operating contract for future build assignments

### Task contract

Every non-trivial implementation task must specify:

- **Outcome:** observable business or user result.
- **Scope:** exact routes, components, APIs, data models, and roles affected.
- **Acceptance criteria:** objective, testable conditions.
- **Exclusions:** explicitly forbidden behavior and files.
- **Data and security:** classification, authorization, privacy, audit, and fail-closed expectations.
- **Dependencies:** provider access, configuration, owner decisions, and external services.
- **Billing impact:** whether the work could activate a paid service or create charges.
- **Rollback:** how to revert safely.
- **Evidence:** commands, test outputs, preview URL, exact commit SHA, and known limitations.

### Required delivery sequence

1. Read `AGENTS.md`, `docs/AGENT_BUILD_FLOW.md`, `docs/agent-control/ACTIVE-WORK.md`, and the linked task contract.
2. Confirm repository, base branch, source head, related pull requests, file ownership, and current drift. Stop if identity or ownership is unknown.
3. Create a scoped issue and isolated branch. Do not commit directly to `main`.
4. Implement the smallest complete vertical slice; do not expand scope without evidence.
5. Add tests for normal behavior, invalid input, unauthorized access, provider failure, and fail-closed behavior as applicable.
6. Run focused tests, then `pnpm run verify` when the environment supports it. Record every skipped or blocked check accurately.
7. Open a pull request that includes change summary, evidence, risks, manual dependencies, and rollback instructions.
8. Require the canonical Vercel preview and exact-head checks. A check that never started is not a pass.
9. Obtain human approval for production, provider, legal, identity, payments, billing, or sensitive-data changes.
10. Merge only after the defined gates pass. Vercel Git integration—not a parallel deployment process—owns production release.
11. Perform safe post-release smoke checks and record the result.

## 4. Quality gates and release status

Use only these statuses:

- `NOT_STARTED`: no work has begun.
- `IN_PROGRESS`: implementation or validation is active.
- `PASS`: evidence proves every required gate on the exact commit.
- `PARTIAL`: some gates passed, with specific remaining gaps.
- `BLOCKED`: a technical, access, or configuration dependency prevents progress.
- `HUMAN_REQUIRED`: a decision or authorization must come from the owner.

A release is **not** production-ready solely because a deployment reports `READY`. The change must also have verified repository identity, clean change inventory, passing applicable tests, successful canonical preview, appropriate independent review, and all required human approvals.

## 5. Capability improvement roadmap

### Stage 1 — Context and change control (this baseline)

- Keep a canonical project register, active-task register, decision log, and blocker/owner list.
- Use repository instructions as the authority for technical work; treat conversational memory as context, not a substitute for current source evidence.
- Refresh old status snapshots before acting.

**Exit criteria:** every new assignment links to a task contract and has a known repository, branch, owner, and acceptance gate.

### Stage 2 — Repeatable implementation

- Use small vertical slices and explicit file ownership.
- Prefer existing patterns, shared components, and current validation/authentication utilities.
- Add regression tests for every defect and focused tests for each new behavior.

**Exit criteria:** all task acceptance criteria are mapped to tests or explicitly identified manual checks.

### Stage 3 — Evidence automation

- Standardize a pull-request template containing task link, exact-head SHA, changed files, checks, security considerations, deployment evidence, manual steps, and rollback.
- Capture test and preview results without copying secrets or sensitive customer data.
- Add only automation that fits the current repository and does not duplicate production deployment.

**Exit criteria:** a reviewer can determine the change's readiness from linked evidence without relying on an agent's unsupported assertion.

### Stage 4 — Independent review and operations

- Review authorization boundaries, privacy, public claims, data migrations, and failure modes independently.
- Keep external providers, paid delivery, payments, identity verification, and other high-impact features disabled until their controls and owner approvals exist.
- Record production smoke checks and rollback outcomes after approved releases.

**Exit criteria:** high-impact changes have explicit approval gates and a tested recovery plan.

## 6. Safety boundaries

- Never place secrets, tokens, passwords, verification codes, private keys, customer documents, or real financial credentials in issues, commits, tests, logs, or this document.
- Never enable paid services, create subscriptions, initiate transactions, or make production/provider changes without the required explicit authorization.
- Never claim an integration is live based only on code, schema, seeded data, or a deployment state.
- Never use production customer data for development or automated tests.
- Never modify the production database schema without a committed migration, compatibility review, rollback plan, disposable-database validation, and owner-approved execution.
- Preserve current authentication, audit, authorization, and fail-closed behavior.

## 7. First deliverable acceptance checklist

- [x] Inspect canonical repository documentation and package scripts.
- [x] Confirm connected GitHub repository access and identify canonical Vercel project metadata.
- [x] Create issue #438 and an isolated documentation branch.
- [ ] Commit this baseline document and verify the resulting commit.
- [ ] Open a pull request and confirm exact changed-file inventory.
- [ ] Run available repository checks and canonical preview; report any blocked checks.
- [ ] Obtain review and merge approval before integrating into `main`.

## 8. Immediate next actions

1. Finish the documentation-only pull request for issue #438.
2. Inspect the active-work register and current pull requests before selecting any application feature.
3. Choose one low-risk, revenue-relevant customer-flow improvement with a bounded file scope.
4. Implement that vertical slice with tests and a canonical preview.
5. Use the result to establish a measured baseline for delivery time, test coverage, escaped defects, and rework.

**Current disposition:** baseline work is in progress. No production code, production configuration, database, provider, billing, or live customer behavior has been changed by this task.
