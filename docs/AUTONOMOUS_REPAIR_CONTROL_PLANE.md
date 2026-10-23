# Autonomous repair control plane

## Goal

Detect production or CI failures, collect evidence, invoke a repair engine, verify its patch, and return a pull request without granting the agent direct production authority.

## Architecture

1. **Detector** — Supabase `pg_cron` invokes a protected GEM monitoring endpoint. This does not depend on Azure or a GitHub-hosted runner.
2. **Evidence intake** — the endpoint records the exact deployment SHA, failing assertion, sanitized response metadata, timestamps, and retry state.
3. **Classifier** — deterministic rules handle known transient failures and configuration drift. Unknown code failures become repair tasks.
4. **Repair engine** — a swappable coding agent receives only the repository, exact task evidence, and a temporary isolated branch.
5. **Verification** — schema checks, claims checks, lint, TypeScript, Vitest, build, security assertions, and production-boundary checks must pass.
6. **Safe output** — the agent may open or update a draft pull request. It may not merge, deploy, change billing, rotate credentials, run production migrations, or mutate live customer data.
7. **Promotion** — a human reviews the diff and evidence before any production promotion.

## Evaluated repair engines

| Engine | Complete issue-to-PR flow | Trigger support | Required runtime or account | Activation decision |
| --- | --- | --- | --- | --- |
| GitHub Copilot cloud agent | Yes | Issues, failed Actions runs, schedules, API | Paid GitHub Copilot plan | Do not enable without confirmed existing entitlement |
| OpenHands Resolver | Yes | `fix-me` label or `@openhands-agent` comment | LLM API key plus Actions/compute | Preferred open-source resolver once cost is capped |
| GitHub Agentic Workflows (`github/gh-aw`) | Yes, as orchestration | Schedules and GitHub events | Copilot request entitlement or model API key | Preferred orchestration and firewall layer |
| Codex Action | Yes | GitHub workflow events | Metered OpenAI API key | Do not enable without an approved API budget |
| mini-SWE-agent | Repair engine only | External orchestration required | Model API or self-hosted model | Useful engine, not the control plane |
| Dependabot | Dependency PRs only | Native schedule | GitHub native service | Enabled for review-only patch PRs |

## Current execution blocker

GitHub-hosted Build Verification failed before runner startup on four consecutive recent pull-request heads. The jobs contain no steps or logs, including a clean rerun. Until GitHub restores runner execution for this repository/account, GitHub Actions cannot be the primary detector or repair runtime even though the repository is public.

## Zero-billing operating mode

- Use Supabase `pg_cron` and `pg_net` for periodic detection.
- Keep Vercel Hobby cron within its once-per-day restriction.
- Keep agentic repair disabled until an existing entitlement or hard cost ceiling is verified.
- Continue deterministic health, security-header, fail-closed, and dependency checks.
- Never enable larger runners, paid GitHub security products, Azure resources, or metered model inference automatically.

## Activation gates for a general repair agent

All gates are mandatory:

1. GitHub-hosted or self-hosted execution is proven by a successful no-op job.
2. The selected agent's model entitlement and maximum spend are known.
3. Repository permissions are limited to contents, issues, and pull requests required for the isolated flow.
4. Network access is allowlisted and secrets are unavailable to untrusted pull-request code.
5. Agent outputs are draft pull requests only.
6. Branch protection requires the complete verification suite and human approval.
7. Production deployment and database operations remain outside agent authority.
