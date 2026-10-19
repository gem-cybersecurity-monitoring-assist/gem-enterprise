# GEM Social Media Command Center

## Purpose

The Social Media Command Center is the canonical governed hub for:

- TikTok
- Facebook Pages
- Instagram professional accounts
- X
- Nextdoor
- Indeed Employer
- LinkedIn Company Pages
- YouTube

The system is fail-closed. Configuration, content generation, account discovery, and rendering readiness are evidence only; none grants permission to publish.

## Canonical implementation

All connector and content-orchestration work belongs in `support371/gem-enterprise`. Do not create a second repository, OAuth state store, credential store, content engine, or publishing pipeline for an individual channel.

Primary paths:

- `src/lib/social-media/providers.ts`
- `src/lib/social-media/policy.ts`
- `src/lib/social-media/oauth/`
- `src/lib/social-media/planning/`
- `src/lib/social-media/orchestration/`
- `src/lib/social-media/publishing/`
- `src/app/api/social-media/`
- `src/app/app/command-center/social-media/`
- `src/lib/facebook/`
- `src/app/api/facebook/`
- `src/app/app/command-center/tokmetric/`

Cross-platform implementation history is tracked in GitHub issue #237.

## Implemented layers

### Governance and readiness

The production foundation provides channel definitions, channel-specific restrictions, compliance and exact-version approval requirements, idempotency requirements, emergency locks, independent provider live gates, a protected readiness API, and operator dashboards.

### Account authorization and lifecycle

TikTok authorization remains inside TokMetric. Meta, X, LinkedIn, YouTube, and Nextdoor use the shared OAuth foundation, which provides:

- signed state bound to actor, workspace, provider, nonce, and expiry;
- PKCE for providers that require or benefit from it;
- single-use durable authorization attempts;
- AES-256-GCM encrypted credentials;
- provider account discovery and multi-account persistence;
- protected connector inventory and deletion;
- token lifecycle, health, refresh serialization, reauthorization, and fail-closed state transitions;
- connector emergency-lock enforcement;
- secret-safe errors, audit evidence, and readiness responses.

The Facebook Operations dashboard must consume this shared Meta connector inventory. The removed Facebook-specific callback must not be restored.

Account authorization stores a credential and discovered account identity only. It does not authorize an external publishing operation.

### Adaptive content orchestration

The internal Content Orchestrator implements the fixed operational flow:

```text
Observe
  ↓
Plan
  ↓
Create
  ↓
Review
  ↓
Publish
  ↓
Engage
  ↓
Learn
  ↓
Repeat
```

It:

- reads current cybersecurity, policy, and market signals from the GEM intelligence store;
- derives approved company source material from the canonical GEM service catalog;
- applies engagement analytics to future signal ranking;
- prevents reuse of historical content fingerprints by default;
- creates at least 20 unique TikTok draft items when TikTok is enabled;
- creates platform-native packages for Facebook Pages, Instagram, X, Nextdoor, LinkedIn, and YouTube;
- includes Indeed only for a genuine vacancy with a vacancy identifier or an approved employer update;
- stores renderer-independent video recipes, visual briefs, captions, hashtags, calls to action, source evidence, risk flags, and publishing checklists;
- requires real human presence and exact-version human approval;
- runs compliance review and creates approval requests only for passing exact versions;
- never invokes a provider adapter or creates an external publishing job directly.

Manual runs use `POST /api/social-media/orchestrator/daily` and require authentication, workspace permissions, same-origin enforcement, and an idempotency key. Scheduled runs use `POST /api/social-media/orchestrator/daily/process` and fail closed unless the dedicated cron secret, workspace ID, and service actor ID are configured.

### Indeed employer workflow

Indeed is deliberately excluded from generic social OAuth. Direct-employer job publishing must use an approved employer-feed path and a genuine approved vacancy or employer update.

### Unified publishing queue

The provider-neutral queue provides atomic claims, bounded retries, dead-letter handling, sanitized provider evidence, explicit connector selection, exact-version hashes, compliance evidence, approval evidence, idempotency, and provider adapter dispatch. Live publishing remains disabled until each provider has completed platform access and operational certification.

## Required publishing sequence

Every external publishing attempt must pass this sequence:

1. Approved company source material exists.
2. A current market or operational signal exists.
3. A unique content fingerprint is generated and checked against history.
4. A versioned content package is created.
5. Unsupported claims, security-sensitive details, regulatory claims, media rights, accessibility, and local-context requirements are reviewed.
6. Channel-specific policy validation passes.
7. Compliance review passes for the exact content version.
8. A different authorized operator approves the exact content version and hash.
9. The explicitly selected destination connector is connected and healthy.
10. Required scopes and platform access are present.
11. The global and provider-specific live gates are enabled.
12. No emergency lock is active.
13. A stable idempotency key is present.
14. A durable worker atomically claims the job.
15. The registered provider adapter performs the external request.
16. The result is stored with sanitized provider evidence, external identifier, timestamps, analytics dimensions, and audit evidence.

## Channel restrictions

### TikTok

TikTok continues through the existing TokMetric OAuth, compliance, approval, publishing-preflight, analytics, and audit modules. Do not bypass TokMetric with a second direct connector. The daily planner enforces a minimum of 20 unique drafts, not 20 automatic external publications.

### Facebook and Instagram

Only Facebook Pages and Instagram Business or Creator accounts may be connected. Personal-profile automation is outside scope. Account selection must be explicit; never auto-select the first discovered Page or professional account.

### X

Only the authorized company account may be connected. Threads and media publication must remain exact-version and approval bound.

### Nextdoor

Every post requires documented local context and an authorized neighborhood or business identity. OAuth and publishing remain blocked until Publish API access evidence is recorded.

### Indeed

Indeed is not a general social feed. The system accepts only genuine approved vacancies or employer updates. Job publishing requires a vacancy identifier.

### LinkedIn

Publishing is limited to an authorized company organization. Community Management API access, organization role validation, and versioned API requests are mandatory.

### YouTube

A connected Brand Account or authorized channel is required. Video rights and disclosure checks remain mandatory. Public-upload activation remains separately audit-gated.

## Secret handling

- Store client secrets and tokens only in managed secret storage.
- Never expose secret values in readiness responses, URLs, logs, browser data, content packages, renderer recipes, or provider response archives.
- Use `SOCIAL_TOKEN_ENCRYPTION_KEY` for non-TikTok provider credentials.
- Continue using `TOKMETRIC_TOKEN_ENCRYPTION_KEY` for the existing TikTok connector.
- Use a dedicated `CONTENT_ORCHESTRATOR_CRON_SECRET` for scheduled generation.
- Rotate credentials after suspected disclosure.
- Never commit live credentials to GitHub.

## Remaining activation sequence

1. Configure the scheduled orchestrator workspace, service actor, provider list, and Nextdoor local context.
2. Connect an approved video renderer by consuming the stored renderer-independent recipe; register every rendered asset through the governed media workflow.
3. Complete provider platform access and operational certification in this order: Meta Page, Instagram, X, LinkedIn, YouTube, and Nextdoor.
4. Keep TikTok inside TokMetric and Indeed inside the approved employer-feed workflow.
5. Run exact-head lint, TypeScript, tests, and canonical Vercel build verification before each merge.
6. Keep global and provider-specific live publishing gates false until the corresponding certification evidence is approved.

## Production gates

The global gate must remain false until a provider has completed certification:

```text
SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED=false
```

Provider-specific gates must also remain false until separately approved. Platform-approval flags must reflect documentary evidence and must never be enabled merely to bypass readiness checks.
