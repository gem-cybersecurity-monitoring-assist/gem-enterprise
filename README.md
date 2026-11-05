# GEM Enterprise Platform

GEM Enterprise is the controlled-access application behind `gemcybersecurityassist.com`. It supports public service discovery, governed onboarding, client workspaces, cybersecurity and compliance coordination, product and service enquiries, support operations, evidence governance, content workflows, and provider integrations.

The platform is in a **controlled production launch**. Provider-dependent, regulated, or high-impact capabilities remain disabled or request-only until their infrastructure, evidence, staffing, authorization, and owner approvals are complete.

## Canonical production identity

| Item | Canonical value |
|---|---|
| Public domain | `https://www.gemcybersecurityassist.com` |
| Repository | `gem-cybersecurity-monitoring-assist/gem-enterprise` |
| Production branch | `main` |
| Vercel project | `support371-gem-enterprise` |
| Package manager | `pnpm@10.28.0` |
| Node runtime | `24.x` |
| Production deployment | Vercel Git integration from `main` |

Do not create a second production deployment, database, authentication system, or Base44-hosted replacement without a documented and approved migration plan.

## Technology stack

| Layer | Technology |
|---|---|
| Application | Next.js 16 App Router, React 18, TypeScript 5.8 |
| Styling | Tailwind CSS 3 and existing shared UI components |
| Database | PostgreSQL through Prisma 5 |
| Authentication | Signed JWT sessions in the HTTP-only `gem_session` cookie; optional approved Supabase gateway |
| Validation | Zod |
| Email | Nodemailer SMTP when production credentials are configured |
| Testing | Vitest and Playwright |
| Hosting | Vercel |
| Analytics | Vercel Analytics and Speed Insights |

## Safety posture

The following are fail-closed or request-only until their activation requirements pass:

- Identity and financial document upload
- Biometric and liveness verification
- Automatic KYC or KYB approval
- Automatic payments and subscriptions
- Marketplace transactions
- Production TikTok publishing, advertising, and shop writes
- Live threat-intelligence assertions
- Guaranteed response times or continuous-monitoring claims
- Public claims without approved supporting evidence

Static, sample, mock, seeded, imported, or manually entered information must not be described as live, verified, certified, encrypted, guaranteed, or available 24/7.

## Local development

### Requirements

- Node.js 24.x
- Corepack
- pnpm 10.28.0
- PostgreSQL 15 or later

### Setup

```bash
corepack enable
git clone https://github.com/gem-cybersecurity-monitoring-assist/gem-enterprise.git
cd gem-enterprise
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run db:generate
pnpm run dev
```

The local application is available at `http://localhost:3000`.

Use a disposable development database. Do not point local development or automated tests at production.

### Database development

```bash
# Generate Prisma client
pnpm run db:generate

# Create and apply a development migration
pnpm run db:migrate -- --name describe-the-change

# Development-only schema synchronization when explicitly appropriate
pnpm run db:push

# Seed a controlled development database
pnpm run db:seed
```

Production schema changes require a committed migration, compatibility review, rollback plan, disposable-database validation, and owner-approved execution. Do not use `prisma db push` against production.

## Repository structure

```text
src/
├── app/                 Next.js pages, layouts, and API route handlers
│   ├── app/             Protected client and administrative application
│   ├── api/             Server-side REST endpoints
│   ├── community-hub/   Fictional interface preview; not a live network
│   ├── kyc/             Controlled onboarding and review routes
│   ├── store/           Request-only product catalogues
│   └── tokmetric/       Governed social-content operations foundation
├── components/          Reusable UI and domain components
├── lib/                 Authentication, database, mail, audit, provider adapters
└── __tests__/           Vitest tests
prisma/
├── schema.prisma        Database source of truth
├── migrations/          Version-controlled migrations
└── seed.ts              Controlled reference and development data
scripts/                 Verification and operational scripts
docs/                    Architecture, deployment, controls, and integration docs
```

## Authentication and authorization

The application uses the existing authentication implementation in `src/lib/auth.ts` and related API routes.

1. A user authenticates through `/client-login`.
2. `/api/auth/login` validates credentials locally or through the configured Supabase gateway.
3. A signed session is stored in the HTTP-only `gem_session` cookie.
4. `src/proxy.ts` protects application, onboarding, decision, review, and administrative routes.
5. Sensitive API routes must independently validate the signed session and resource authorization.
6. Roles, organization membership, workspace permissions, entitlements, and ownership checks are separate controls.

Open self-registration is disabled. Accounts are provisioned through approved onboarding or administrator-controlled invitation.

## Public routing notes

- `/community` temporarily redirects to `/community-hub` while identity, staffing, affiliation, and operating claims undergo evidence review.
- `/community-hub` is a fictional, non-indexed interface preview. It is not a live member network, marketplace, event programme, or secure messaging service.
- `/register` permanently redirects to `/get-started`; it does not enable self-registration.
- `/command-center` and `/admin-command` redirect to the separately hosted administrative command centre.
- Store pages are request-only and do not create orders, subscriptions, payment obligations, inventory commitments, or service-level agreements.

## Core application domains

The Prisma schema includes foundations for:

- Users, profiles, roles, sessions, and entitlements
- KYC applications, reviews, decisions, and document metadata
- Support tickets, service requests, meetings, and notifications
- Products and portfolios
- Auditing, consent records, evidence, and AI governance
- News ingestion and content presentation
- Organizations, workspaces, roles, permissions, and connectors
- Campaigns, content versions, media assets, compliance reviews, approvals, publishing jobs, webhooks, idempotency, and analytics

Some domains remain preview-only or provider-gated. Model presence does not imply production activation.

## Environment configuration

Use `.env.example` as the canonical variable inventory. Store real values only in approved secret stores and Vercel Project Settings.

Important groups include:

- PostgreSQL pooled and direct connections
- JWT and password-reset signing secrets
- Canonical application URL and name
- SMTP and reply-to configuration
- Platform Operations Agent credentials
- Supabase evidence-vault server credentials
- Audit and upload feature gates
- TokMetric OAuth, webhook, encryption, and publishing gates

Never commit `.env.local`, API keys, service-role keys, OAuth secrets, SMTP credentials, reset tokens, or customer data.

## Verification gate

Before a pull request is represented as ready, run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run verify
```

`pnpm run verify` performs:

1. Prisma client generation
2. ESLint with zero warnings
3. TypeScript checking
4. Vitest tests
5. Next.js production build

If a check cannot run, report it as **blocked** or **not run**. Never describe an unstarted workflow as passing.

## Deployment

Vercel Git integration owns production deployment.

- Pull requests create canonical preview deployments.
- Preview verification must pass before merge.
- Approved changes merge to `main`.
- Vercel deploys `main` to production.
- Do not run a second `vercel --prod` workflow from CI or another agent.
- Database migrations are separate, controlled operations and are not automatically authorized by a code merge.

See:

- [`DEPLOYMENT.md`](DEPLOYMENT.md)
- [`DEVELOPER_ONBOARDING.md`](DEVELOPER_ONBOARDING.md)
- [`docs/CANONICAL_PRODUCTION_ARCHITECTURE.md`](docs/CANONICAL_PRODUCTION_ARCHITECTURE.md)
- [`AGENTS.md`](AGENTS.md)

## Contribution workflow

1. Create or reference a GitHub issue.
2. Branch from current `main` using `feat/`, `fix/`, `security/`, `test/`, `docs/`, or `chore/`.
3. Inspect affected routes, APIs, schema, tests, configuration, and related pull requests.
4. Implement the smallest complete vertical slice.
5. Add tests for success, validation failure, authorization failure, provider failure, and fail-closed behavior as applicable.
6. Run `pnpm run verify`.
7. Open a pull request with risks, manual dependencies, evidence, and rollback notes.
8. Require the canonical Vercel preview to pass.
9. Merge only after the available required gates and human approvals pass.
10. Run production smoke checks without using sensitive data or causing billable external actions.

## License

Proprietary. All rights reserved.
