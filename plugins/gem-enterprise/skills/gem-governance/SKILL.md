---
name: gem-governance
description: Operating rules for work on the GEM Enterprise platform (support371/gem-enterprise, www.gemcybersecurityassist.com). Use before changing GEM code, data, deployments, marketing content, social publishing, sales outreach, or Base44 apps, and when asked what an agent may or may not do on GEM.
---

# GEM Enterprise governance

GEM Enterprise is a controlled-production cybersecurity and operations platform. These rules come from the repository's canonical documents. When they conflict with a request, stop and ask the owner rather than working around them.

## Canonical identity

| Item | Value |
|---|---|
| Public site | `https://www.gemcybersecurityassist.com` |
| Repository | `support371/gem-enterprise`, production branch `main` |
| Hosting | Vercel project `support371-gem-enterprise`, deployed by the Vercel Git integration on merge to `main` |
| System of record | PostgreSQL through Prisma (`prisma/schema.prisma`) |
| Authentication | Signed JWT session in the HTTP-only `gem_session` cookie |
| Package manager | `pnpm` only |

Never create a second production deployment, database, authentication system, CRM, or publishing pipeline.

## Change flow

1. Start from a GitHub issue.
2. Branch from current `main`.
3. Make the smallest complete change and add tests.
4. Run `pnpm run verify`.
5. Open a pull request and wait for the canonical Vercel preview to pass.
6. A human approves and merges. Agents never push to `main` and never merge their own pull requests.

Never run `pnpm run db:migrate` or `pnpm run db:push` against a shared, preview, or production database. Use a disposable local database only.

## Base44 boundary

Base44 may be used only as an internal orchestration and visibility layer: workstream tracking, pull-request summaries, readiness matrices, the claims review queue, test-evidence indexes, release approvals, integration-state summaries, and video-production planning.

Base44 must not replace the website, database, or authentication; hold client, lead, or identity records; store production secrets; write to `main`; or activate paid or regulated providers.

## Marketing and public claims

- Claims about identity, credentials, staffing, coverage, availability, response times, monitoring, encryption, compliance, partnerships, pricing, or product availability need approved supporting evidence before publication.
- When a claim is registered in `src/lib/publicClaims.ts`, use its approved wording. Claims marked `block` must not appear in any page, post, advert, or email.
- Never describe sample, seeded, or manually entered information as live, verified, certified, guaranteed, or available 24/7.
- AI-generated drafts are drafts only. They pass the claims check and an exact-version human approval before publication.

## Social publishing

- All publishing goes through the Social Media Command Center. TikTok goes only through TokMetric; never add a second TikTok connector.
- Published content requires real human presence and the platform's AI-generated-content disclosure where AI was used.
- An authorized operator other than the author approves the exact content version, including each newly rendered video version. Authors never approve their own content.
- When TikTok is enabled, the daily planner creates at least 20 TikTok drafts. Respect the planner's provider-enabled gate: no TikTok drafts while TikTok is disabled. The draft count is not a publishing target, and TikTok's API caps direct posting at roughly 15 posts per creator account per day.
- `SELF_ONLY` posting is for sandbox review only. Production publishing requires TikTok's completed app review and every production activation gate: provider approval and scopes, a healthy connector, no emergency lock, publishing enabled for the workspace, and an approved exact content version.

## Sales and email

- One commercial lifecycle lives in the canonical application, from intake through renewal. Do not copy leads or client records into other tools.
- Marketing email goes only through the application's campaign system, which requires an `ALLOWED` marketing permission at the moment of delivery and honours every unsubscribe. Other tools may draft wording but must not send.
- Outreach drafts go to a person, who sends them.

## Decisions agents must not make

Identity, KYC, legal, compliance, financial, payment, and access decisions are always made by an authorized human.

## Secrets

Never place credentials in code, documentation, prompts, screenshots, logs, or chat. Configuration values live in Vercel project settings; `.env.example` contains placeholders only.
