# GEM production read-only health monitoring

## Purpose and operating cost

One standard GitHub-hosted Linux runner on a public repository checks the canonical production site daily at 08:17 UTC. It also supports manual workflow_dispatch. No npm install, external credentials, paid providers, cloud branch creation, or repository mutations are involved in the checks. Keep account spending limits at $0. A skipped Actions run means UNKNOWN, not healthy.

The source is scripts/production-readonly-smoke.mjs. The policy is restricted to HTTPS GET on www.gemcybersecurityassist.com (or its verified Vercel alias) and only these endpoints:

- / — publicly available homepage status 200
- /api/health — selected persistence authority and API readiness
- /api/v1/production/health — compatible backend and service status

HTTPS, 15-second request timeouts, a strict target-host allowlist and cache-control checks are enforced. No tokens, cookies, provider logins, social posts, migrations or external writes are used. Results appear in GitHub Actions job logs and Step Summary, without customer data.

## What green means

Green means public website and API availability, consistent backend authority and appropriate non-caching responses. It does NOT verify actual login, SMTP recovery, provider approval, business messaging, video posting, live Redis failover, or database migrations. The monitor always reports these limitations. A GitHub versus Vercel commit difference is a warning, because deployment can legitimately lag the repository.

Production may select supabase_gateway without an active direct Prisma URL. Never treat that as a reason to enable unsafe fallback. Gateway social jobs can correctly return 503 until an audited, tenant-scoped transactional persistence backend is deployed.

## Incident handling

- Core API down: compare the exact Vercel deployment with main and read runtime error logs; track authorized gateway remediation in issue #259.
- Social publishing blocked: inspect issue #262. Verify authorized active Supabase owner/project, tenant roles, secure storage, migrations, gateway audit and actual provider OAuth approvals before allowing a post.
- Supabase Preview failing with missing remote migration versions: request the actual linked project's migration history from its owner. The current Supabase connector cannot access project slzdjoqpzbkwzuaexlkj. Do not rewrite migration history, apply blind SQL, or create a paid database.
- Vercel rate limits on unrelated projects: do not pay or count those as failure of the canonical support371-gem-enterprise production deployment.
- GitHub Actions job not started: treat as monitor unavailable, not a healthy signal. Do not auto-merge or auto-rollback.

## Manual command (Node 24)

```sh
node --test scripts/production-readonly-smoke.test.mjs
GEM_SMOKE_URL=https://www.gemcybersecurityassist.com node scripts/production-readonly-smoke.mjs
```

## Human-required acceptance

Authenticated browser checks, SMTP recovery, verified provider token scopes, Telegram channel rights, sandbox exact-asset TikTok read-back, production migration/backup restoration and shared Redis outage tests remain separate controlled work. A public health response is not certification for these functions.
