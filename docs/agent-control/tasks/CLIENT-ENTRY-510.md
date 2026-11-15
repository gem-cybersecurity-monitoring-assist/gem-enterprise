# Public new-client intake and SaaS lifecycle routing — Issue #510

Repository: canonical `gem-cybersecurity-monitoring-assist/gem-enterprise`
Base: `de79e803a917ae75c755b93092951e22b36d3047`
Branch: `fix/new-client-intake-entry-510`.
Owner: ChatGPT Work, focused public-entry and SaaS lifecycle lane.

## Verified regression being repaired

- The public `/get-started` and `/eligibility/status` pages linked enterprise applicants to `/request-access`, an exclusively Community-focused form.
- The old `RequestAccessForm` posted `hub_access_request` to `/api/intake/submit`. That server route intentionally returns HTTP 410 `SEPARATED_INTAKE_REQUIRED` for this serviceType. The legacy entry page therefore could not successfully submit as designed.
- The correct dedicated routes already exist: `/enterprise/apply` → `/api/intake/enterprise` and `/community/apply` → `/api/intake/community`. Both call `handlePublicIntake`, which must persist a durable record before returning success, with a controlled 503 on unavailable storage.
- The existing account-creation path is a controlled one-time Platform Owner-issued invitation (`/app/admin/workspace-access` → `/workspace-invitation` → `/client-login` → `/app/workspace`), not anonymous self-signup.

## Implemented in this workstream

1. Route enterprise CTAs to the existing enterprise application, retaining eligibility as an optional prior step.
2. Replace the broken legacy Community form with the already-implemented `PublicIntakeForm kind="COMMUNITY"`; preserve its distinct intake queue, consent and validation.
3. Remove unsupported 10-business-day decisions and claims that future membership currently exists.
4. Display a mobile-friendly, linked, six-stage Client Activation Journey on the **existing** protected SaaS dashboard. Stages are source-navigation guidance, not production certification.
5. Add rendered route and dashboard regression tests and explicit truthfulness assertions.

## Separate acceptance and dependencies

- Automated full repo build, tests, lint, typecheck, tracked-secret scan and canonical Git-owned Vercel preview on **exact branch head**.
- Check production public page routes /get-started, /eligibility/status, /enterprise/apply, /request-access, /community/apply, /client-login, /workspace-invitation.
- An actual successful durable intake write and reviewer assignment in a controlled test environment, invitation issue/accept/account creation, one test owner and client, tenant A/B isolation, SMTP delivery and recovery, MFA, KYC approval, workspace data permissions, request-to-closure workflow, backups and monitoring remain **NOT CERTIFIED** unless independently exercised and recorded.
- Separate external service connections, social publishing approvals, payments and billing retain existing disabled/approval-required states.

No real account, personal data, KYC identity, secret, paid service, payment, provider write, external publication, production schema or other repository is modified.
Rollback: revert the focused PR; this PR changes no database schema.
Status: IMPLEMENTED ON BRANCH; exact-head hosted acceptance pending.
