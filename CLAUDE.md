# GEM Enterprise — Complete Implementation Reference

> **For AI agents (Claude Code, v0, Cursor, Copilot):** This file is the canonical map of the entire application. Read this before making any changes. Every section cross-references actual file paths.

---

## 1. Stack & Runtime

| Concern | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL 15+ | — |
| ORM | Prisma | 5.22.x |
| Auth | Custom JWT via `jose` | — |
| UI Components | shadcn/ui (Radix primitives) | — |
| Styling | Tailwind CSS | 3.x |
| AI | Vercel AI SDK + AI Gateway with deterministic fallback | 6.x |
| Email | nodemailer | 8.x |
| Package manager | **pnpm** (always — never npm/yarn) | 10.x |
| Deployment | Vercel | — |

---

## 2. Data Path — How Data Flows

```
Browser / v0 component
        │  fetch('/api/...')
        ▼
Next.js API Route  (/src/app/api/**/route.ts)
        │  getSession() → verifies JWT cookie
        │  Zod schema → validates request body
        │  db.model.method() → Prisma query
        ▼
PostgreSQL  (via POSTGRES_PRISMA_URL)
        │  returns typed record
        ▼
API Route  → NextResponse.json({ ... })
        ▼
Browser / v0 component  → useState / renders data
```

**Auth cookie:** `gem_session` — HttpOnly, Secure in production.  
**Session helper:** `import { getSession } from "@/lib/auth"` — returns `SessionPayload | null`.  
**DB client:** `import { db } from "@/lib/db"` — singleton Prisma client.  
**Audit logging:** `import { emitAuditLog } from "@/lib/audit"` — call after every sensitive mutation.

---

## 3. Database Models & Relationships

### Core Identity

```
User (users)
 ├── Profile (user_profiles)          — 1:1, personal info
 ├── KYCApplication[] (kyc_applications)
 │    ├── KycDocument[]               — uploaded files
 │    ├── KYCReview[]                 — reviewer notes
 │    └── Decision                    — final approve/reject
 ├── Entitlement[]                    — product access grants (slug-based)
 ├── Notification[]                   — in-app alerts
 ├── AuditLog[]                       — action trail
 ├── PortfolioMembership[]            — portfolio access
 ├── SupportTicket[]                  — help desk tickets
 ├── ServiceRequest[]                 — operational requests
 ├── ApiKey[]                         — developer API keys
 └── MeetingRequest[] "MeetingRequests"
```

### Products & Portfolios

```
Product (products)                   — slug-keyed service catalog
Portfolio (portfolios)
 └── PortfolioMembership[]           — userId + role (viewer/manager)
```

### Support & AI

```
SupportSession (support_sessions)
 ├── messages: Json[]                — chat transcript stored as JSON array
 ├── SupportBooking[]
 └── SupportEscalation[]

AiRun (ai_runs)                      — every AI widget session
 └── ConsentRecord                   — GDPR disclosure receipt
```

### News Intelligence

```
NewsSource (news_sources)
 └── NewsArticle[] (news_articles)
NewsIngestionRun (news_ingestion_runs) — cron job audit
```

### New Models (migration pending in production)

```
ApiKey (api_keys)          — developer portal keys, keyHash stored, prefix shown
EmailCampaign (email_campaigns) — admin broadcast emails
MeetingRequest (meeting_requests)   — member/advisor meeting booking
```

---

## 4. Complete API Route Map

All routes require authentication via `getSession()` unless marked **PUBLIC**.

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Email+password → sets `gem_session` cookie |
| POST | `/api/auth/logout` | Clears session cookie |
| GET | `/api/auth/session` | Returns current session payload |

### User & Profile
| Method | Path | Returns / Accepts |
|---|---|---|
| GET | `/api/users/profile` | `{ email, createdAt, profile: {...}, kycStatus }` |
| PATCH | `/api/users/profile` | `{ firstName, lastName, phone, country, ... }` |
| PATCH | `/api/users/password` | `{ currentPassword, newPassword }` → 403 if wrong |

### Dashboard
| Method | Path | Returns |
|---|---|---|
| GET | `/api/dashboard/summary` | `{ entitlements, openRequests, unreadNotifications, kycStatus }` |

### KYC
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/kyc` | Get/start KYC application |
| POST | `/api/kyc/submit` | Submit application for review |
| POST | `/api/kyc/documents` | Upload document reference |

### Portfolios & Documents
| Method | Path | Returns |
|---|---|---|
| GET | `/api/portfolios` | User's portfolios via `PortfolioMembership` |
| GET | `/api/documents` | User's KYC documents from `KycDocument` |

### Notifications & Requests
| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/api/notifications` | List / mark as read |
| GET/POST | `/api/requests` | Service requests CRUD |
| GET/POST | `/api/ticket` / `/api/ticket/create` | Support tickets |

### Support & AI Chat
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/support/session/start` | Opens `SupportSession` |
| POST | `/api/support/session/consent` | Records GDPR consent |
| POST | `/api/support/message` | Sends message, returns AI reply |
| POST | `/api/support/escalate` | Escalates to human |
| POST | `/api/assistant/session` | Opens `AiRun` record |
| POST | `/api/assistant/message` | Main AI widget endpoint → Claude API |

### Developer Portal
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/developers/keys` | List active keys / create new key (returns plaintext once) |
| DELETE | `/api/developers/keys/[id]` | Revoke key (sets `revokedAt`) |
| GET | `/api/developers/logs` | Paginated audit log |
| GET | `/api/developers/webhooks` | Stub — v2 |

### Admin
| Method | Path | Requires |
|---|---|---|
| GET | `/api/admin/stats` | admin role → `{ totalUsers, pendingKyc, openApprovals, openTickets }` |
| GET/PATCH | `/api/admin/kyc` | KYC queue + approve/reject decisions |
| GET/PATCH | `/api/admin/users` | User list + role/status management |
| GET/POST | `/api/admin/campaigns` | Email campaign CRUD |
| PATCH | `/api/admin/campaigns/[id]` | Update campaign |
| POST | `/api/admin/campaigns/[id]/send` | Send campaign via nodemailer |
| GET | `/api/admin/news/sources` | RSS feed sources |
| POST | `/api/admin/news/ingest` | Trigger news ingestion |

### Meetings
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/meetings` | List user's meetings / create request |
| PATCH | `/api/meetings/[id]` | Confirm / cancel / complete |

### Misc
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check — PUBLIC |
| POST | `/api/contact` | Contact form — PUBLIC |
| GET | `/api/routes` | Route manifest — PUBLIC |
| POST | `/api/intake/submit` | Intake form — PUBLIC |

---

## 5. Frontend Page → API Mapping

### Client Portal (`/app/*`)

| Page | File | API calls |
|---|---|---|
| Dashboard | `src/app/app/dashboard/page.tsx` | `GET /api/dashboard/summary` |
| My Portfolio | `src/app/app/my-portfolio/page.tsx` | Static (wire to `/api/portfolios`) |
| Savings Vault | `src/app/app/savings-vault/page.tsx` | Static display |
| Portfolios | `src/app/app/portfolios/page.tsx` | `GET /api/portfolios` |
| Products | `src/app/app/products/page.tsx` | Static (wire to entitlements) |
| Profiles | `src/app/app/profiles/page.tsx` | Static |
| Documents | `src/app/app/documents/page.tsx` | `GET /api/documents` |
| Requests | `src/app/app/requests/page.tsx` | `GET/POST /api/requests` |
| Messages | `src/app/app/messages/page.tsx` | Static (wire to SupportSession) |
| Meetings | `src/app/app/meetings/page.tsx` | `GET/POST /api/meetings` |
| Notifications | `src/app/app/notifications/page.tsx` | `GET/PATCH /api/notifications` |
| Support | `src/app/app/support/page.tsx` | `POST /api/ticket/create` |
| Compliance | `src/app/app/compliance/page.tsx` | Static |
| Profile | `src/app/app/profile/page.tsx` | `GET/PATCH /api/users/profile` |
| Settings | `src/app/app/settings/page.tsx` | `PATCH /api/users/profile` |
| Security | `src/app/app/security/page.tsx` | `PATCH /api/users/password` |

### Admin Portal (`/app/admin/*`)

| Page | File | API calls |
|---|---|---|
| Admin Home | `src/app/app/admin/page.tsx` | `GET /api/admin/stats` |
| KYC Queue | `src/app/app/admin/kyc/page.tsx` | `GET/PATCH /api/admin/kyc` |
| Users | `src/app/app/admin/users/page.tsx` | `GET/PATCH /api/admin/users` |
| Approvals | `src/app/app/admin/approvals/page.tsx` | `PATCH /api/admin/kyc` |
| Campaigns | `src/app/app/admin/campaigns/page.tsx` | `GET /api/admin/campaigns` + send |
| New Campaign | `src/app/app/admin/campaigns/new/page.tsx` | `POST /api/admin/campaigns` |
| News | `src/app/app/admin/news/page.tsx` | `GET /api/admin/news/sources` |
| Allocations | `src/app/app/admin/allocations/page.tsx` | Static |

### Developer Portal (`/developers/*`)

| Page | File | API calls |
|---|---|---|
| Overview | `src/app/developers/page.tsx` | Static |
| API Keys | `src/app/developers/security/page.tsx` | `GET/POST/DELETE /api/developers/keys` |
| Logs | `src/app/developers/logs/page.tsx` | `GET /api/developers/logs` |
| Webhooks | `src/app/developers/webhooks/page.tsx` | `GET /api/developers/webhooks` |

### Documentation (`/docs/*`)

All 21 docs pages are static content under `src/app/docs/` with shared layout at `src/app/docs/layout.tsx`.

---

## 6. Design System

### Color Tokens (use these in v0 components)

```css
/* Primary accent — electric cyan */
hsl(185 100% 45%)          /* --electric-cyan, --svc-cyber */
hsl(185 100% 45% / 0.12)   /* --svc-cyber-muted — muted backgrounds */

/* Secondary — night plum (purple) */
hsl(280 40% 25%)            /* --night-plum, --svc-financial */

/* Backgrounds */
hsl(220 15% 12%)            /* --background (dark) */
hsl(220 15% 15%)            /* --card */

/* Text */
hsl(40 20% 98%)             /* --foreground (off-white) */
hsl(220 10% 60%)            /* --muted-foreground */
```

### Tailwind Utility Classes (defined in globals.css)

```
glass-panel         → frosted glass card (backdrop-blur)
nav-active          → active nav link highlight
glow-cyan           → electric cyan box-shadow glow
animate-pulse-slow  → 3-second pulse animation
```

### shadcn/ui Components Available

All standard shadcn/ui components are installed:
`Button`, `Card`, `Badge`, `Table`, `Dialog`, `Sheet`, `Avatar`, `Progress`,
`DropdownMenu`, `Tabs`, `Input`, `Label`, `Textarea`, `Select`, `Switch`,
`Accordion`, `Alert`, `Skeleton`, `Tooltip`, `Popover`, `Command`, `Form`

Import from `@/components/ui/[component-name]`.

### Fonts

- **Sans:** Inter (body, UI)
- **Mono:** JetBrains Mono (code blocks)
- **ATR sub-brand:** Manrope

---

## 7. Key Shared Libraries

| Import | Purpose |
|---|---|
| `@/lib/auth` → `getSession()` | Get current user session from cookie |
| `@/lib/db` → `db` | Prisma client singleton |
| `@/lib/audit` → `emitAuditLog()` | Write to `audit_logs` table |
| `@/lib/orchestration/orchestrate-support-reply` → `generateAIReply()` | Call Claude API |
| `@/lib/platformNavigation` | Nav structure + icon type definitions |
| `@/lib/utils` → `cn()` | Tailwind class merging (clsx + twMerge) |

---

## 8. Adding a New Feature (Template)

### New API route

```typescript
// src/app/api/your-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emitAuditLog } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ field: z.string().min(1) });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await db.yourModel.findMany({ where: { userId: session.userId } });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const record = await db.yourModel.create({ data: { ...body.data, userId: session.userId } });
  await emitAuditLog({ action: "admin_action", userId: session.userId, resource: "your_model", resourceId: record.id });
  return NextResponse.json({ record }, { status: 201 });
}
```

### New client page (wired to API)

```typescript
// src/app/app/your-page/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function YourPage() {
  const [data, setData] = useState<YourType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/your-feature")
      .then(r => r.json())
      .then(d => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">
        Page <span className="text-cyan-400">Title</span>
      </h1>
      <Card className="bg-card border-white/10">
        <CardHeader><CardTitle className="text-white">Section</CardTitle></CardHeader>
        <CardContent>{/* your content */}</CardContent>
      </Card>
    </div>
  );
}
```

---

## 9. Environment Variables

### Required (Vercel → Settings → Environment Variables)

| Variable | Description |
|---|---|
| `POSTGRES_PRISMA_URL` | Pooled connection string (Neon/Supabase) |
| `POSTGRES_URL_NON_POOLING` | Direct connection string for migrations |
| `JWT_SECRET` | Min 32 chars — `openssl rand -hex 32` |
| `GEM_AI_PROVIDER_ENABLED` | Enables governed AI Gateway generation; `false` keeps deterministic support active |

### Optional (enables features)

| Variable | Feature |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email campaigns + meeting confirmations |
| `EMAIL_FROM` | Sender address for outbound emails |
| `GEM_AI_MODEL` | Gateway model override (default: `openai/gpt-5.6-luna`) |
| `NEXT_PUBLIC_APP_URL` | Public URL for redirects |
| `NEXT_PUBLIC_APP_NAME` | App name shown in UI |
| `NEXT_PUBLIC_AI_DISCLOSURE_TEXT` | Compliance text for AI widget |
| `AUDIT_ENABLED` | Set to `'true'` to persist audit logs |
| `CRON_SECRET` | Protects `/api/cron/news-ingest` |
| `ATLASSIAN_JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN` | Real ticket escalation |

---

## 10. Database Migrations

Three new models need to be migrated before these features work in production:
- `ApiKey` (developer portal keys)
- `EmailCampaign` (admin campaigns)
- `MeetingRequest` (member meetings)

> **Never run `pnpm run db:migrate` (`prisma migrate dev`) or `pnpm run db:push` (`prisma db push`) against a shared, preview or production database.** The production schema is the product of migrations, `db push` and Supabase SQL-editor changes. Against a database built from migrations, `db push` would drop about 30 raw-SQL-managed tables, and `migrate dev` may offer to reset the database. Use them only on a disposable local database. See `docs/GEM_MIGRATION_INTEGRITY_20261017.md`.

```bash
# Disposable local database only:
pnpm run db:migrate

# Disposable local database only (no migration history):
pnpm run db:push

# Regenerate Prisma client after schema changes (local files only):
pnpm run db:generate

# Replay the migration chain into a disposable *_test database:
scripts/verify-migration-chain.sh <name>_test --stub scripts/verify-local-authorization.supabase-stub.sql
```

---

## 11. v0 Integration Guide

When extending this app with v0.dev components:

1. **Copy these design tokens into the v0 project settings:**
   - Primary: `hsl(185 100% 45%)` (electric cyan)
   - Background: `hsl(220 15% 12%)`
   - Card: `hsl(220 15% 15%)`
   - Font: Inter (sans), JetBrains Mono (code)

2. **Import these shadcn/ui component aliases** (already installed):
   ```
   @/components/ui/button
   @/components/ui/card
   @/components/ui/badge
   @/components/ui/table
   ```

3. **Wire data with these fetch patterns:**
   ```typescript
   // All authenticated API calls follow this pattern:
   const res = await fetch("/api/endpoint");
   if (!res.ok) { /* handle 401 → redirect to /client-login */ }
   const { data } = await res.json();
   ```

4. **Auth redirect:** Unauthenticated users on `/app/*` routes are automatically redirected to `/client-login` by `src/middleware.ts`.

5. **Admin check:** Pages under `/app/admin/*` require `session.role === 'admin'` or `'super_admin'`.

---

## 12. Local Development

```bash
# Install
pnpm install

# Generate Prisma client (required after schema changes)
pnpm run db:generate

# Dev server
pnpm dev

# Tests (100/100 passing)
pnpm test

# Lint (0 errors)
pnpm run lint

# Production build
pnpm run build
```

---

## 13. What's Production-Ready vs. Pending

### Fully Implemented
- JWT auth (login, logout, session, middleware protection)
- KYC flow (start → submit → document upload → review → approve/reject)
- AI chat widget with GDPR consent, restricted-class detection, Claude API
- Support sessions with escalation and Jira integration
- Admin: KYC queue, user management, campaigns, news ingest
- Developer portal: API keys, logs, webhooks stub
- Email campaigns via nodemailer
- Meeting requests with confirmation emails
- Notifications (in-app)
- 21 documentation pages at `/docs/*`
- Dashboard aggregated stats
- Portfolio + document views
- Password change

### Database Migration Pending (schema complete, needs `db:migrate`)
- `ApiKey` model
- `EmailCampaign` model
- `MeetingRequest` model

### Marked for v2
- Webhook management (real `Webhook` model and delivery)
- Real-time messages (websocket or polling on `SupportSession.messages`)
- Community hub dynamic data (currently mock)
- Admin allocations (currently static)
- Security session list (requires server-side session store)
