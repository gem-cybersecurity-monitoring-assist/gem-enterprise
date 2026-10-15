# GEM Market-Entry Launch Pack — Organic Content and Paid-Readiness Handoff

**Status:** Draft content prepared for review; not published or scheduled.  
**Owner:** GEM market-entry operator.  
**Scope:** Business customer acquisition first; a separate individual/family lane after its route is live.  
**Zero-spend rule:** Do not activate billing or paid distribution from this pack.  
**Current primary business CTA:** `https://www.gemcybersecurityassist.com/business-review`  
**Individual CTA:** `https://www.gemcybersecurityassist.com/personal-security` — hold until PR #434 is approved, merged, deployed to the canonical project, and the route is smoke-tested.

## 1. Launch decision

GEM can begin a **controlled organic soft launch** once the operator confirms the business review form is accepting submissions and the public privacy/contact links are correct. Content can be prepared and uploaded as drafts now. Do not begin paid advertising or automated publishing yet.

Current known state from the repository:
- The existing Business Security & Operations Review page is public and presents a $199 bounded offer for qualified businesses, covering one business, one primary domain, and an initial review for teams up to 10 people.
- The Ads Bridge package is explicitly **PAUSED / PREVIEW_ONLY / USD $0**; paid delivery is **BLOCKED** until provider billing, positive budget, and owner activation are handled separately.
- Social publishing is designed to fail closed. CI does not prove provider OAuth, channel ownership, production storage, database migrations, or successful external publishing.
- In production, the social automation workstream documents a Supabase gateway boundary: scheduled publishing must remain blocked until its transactional gateway backend and schema are verified.
- PR #434 adds `/market-entry` and `/personal-security`; it is open and has CI evidence, but those new routes must not be promoted in public content until the canonical release and browser checks are complete.

## 2. Messaging guardrails

Use these claims:
- “A bounded initial review that helps identify priorities.”
- “Subject to qualification, confirmed scope, and agreement.”
- “A request does not activate a paid service.”
- “The public offer is not a penetration test, certification, legal opinion, or guarantee of continuous monitoring.”
- “Practical security and operational readiness.”

Do not claim:
- GEM detected a prospect's breach or compromised credentials.
- Guaranteed prevention, recovery, certification, or 24/7 response.
- That a channel is monitored, authenticated, connected, or staffed unless it is verified.
- That the free readiness checklist or an inquiry activates a client workspace or paid service.
- That the last few founding slots remain unless that availability is confirmed.
- That a social account is connected because a provider appears in the code or dashboard.

Avoid fear-based targeting, inferred vulnerabilities, customer logos/testimonials without permission, identifiable personal details, and sensitive incident evidence in public comments.

## 3. Approved business CTA links

Each link preserves the existing campaign identity and uses a stable source/medium:

| Channel | Tracked destination |
|---|---|
| LinkedIn | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=linkedin&utm_medium=organic-social&utm_campaign=founding-first-20` |
| Facebook Page | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=facebook&utm_medium=organic-social&utm_campaign=founding-first-20` |
| Instagram Professional | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=instagram&utm_medium=organic-social&utm_campaign=founding-first-20` |
| X company account | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=x&utm_medium=organic-social&utm_campaign=founding-first-20` |
| TikTok | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=tiktok&utm_medium=organic-social&utm_campaign=founding-first-20` |
| YouTube | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=youtube&utm_medium=organic-social&utm_campaign=founding-first-20` |
| Telegram | `https://www.gemcybersecurityassist.com/business-review?lead=campaign&campaign=founding-first-20&utm_source=telegram&utm_medium=organic-social&utm_campaign=founding-first-20` |

After a channel has an authorized public profile, use that channel's URL in its bio/about field. Do not direct any post to `/market-entry` or `/personal-security` until the new routes are live and tested. The existing Business Review page is the live business conversion path.

## 4. Seven-day organic publishing sequence

All items below are **DRAFT — NOT PUBLISHED**. Upload each only to the explicitly authorized GEM business account for the named channel. Do not publish to a founder's personal profile or personal social account without separate authorization.

### Day 1 — LinkedIn company page: launch the bounded business offer

**Post copy**

> Security readiness does not have to start with a giant program. It can start with a few practical questions:
>
> • Is multi-factor authentication enabled on business email, finance, and administrator accounts?  
> • Can you identify and remove access when a team member leaves?  
> • Are payment-detail changes verified through a second trusted channel?  
> • Have you confirmed that critical information can actually be restored from backup?
>
> GEM's Business Security & Operations Review is a bounded first step for qualified small and growing businesses. It focuses on access, public exposure, operational dependencies, incident readiness, and the next priorities to address.
>
> The founding review is $199, subject to qualification and agreed scope. It is not a penetration test, certification, or promise of continuous monitoring. A request does not activate a service or create a charge.
>
> **Know what to fix first:** use the tracked Business Review link.

**Creative brief:** 1200×627 or 1080×1350. Clean dark-navy background, cyan headline “Know What to Fix First”, three simple line icons (identity, operational continuity, response readiness). Use a small “Illustrative” label if a dashboard visual is included. No fake metrics or certification badges.

**Alt text:** “GEM Enterprise business-readiness graphic highlighting identity and access, operational continuity, and incident preparation.”

### Day 2 — Facebook Page: plain-language small-business post

**Post copy**

> If your business email stopped working tomorrow, would you know how to recover it?
>
> A useful first check is to know who controls your domain and email, keep multi-factor authentication on important accounts, verify unusual payment-change requests separately, and test whether key files can be restored.
>
> GEM offers a bounded $199 Business Security & Operations Review for qualified businesses. The review helps prioritize next steps; it is not a certification or a guarantee that incidents cannot happen. GEM confirms fit and scope before any paid work begins.
>
> **Start with the Business Review:** use the tracked link.

**Creative brief:** 1080×1080 square card, one question as the headline, no alarmist imagery.

**Alt text:** “A business email recovery question with four practical readiness checks: account ownership, multi-factor authentication, payment verification, and backups.”

### Day 3 — Instagram Professional: six-slide carousel

**Slide 1:** “Know what to fix first.”  
**Slide 2:** “Access: Who can still sign in to your business accounts?”  
**Slide 3:** “Email: Is MFA enabled, and who controls recovery?”  
**Slide 4:** “Payments: Are changed bank details checked through a separate trusted channel?”  
**Slide 5:** “Recovery: Have you tested restoring the information your business depends on?”  
**Slide 6:** “Make a prioritized plan. GEM Business Security & Operations Review — $199, subject to qualification and scope.”

**Caption**

> Good security starts with clear operating habits, not panic. Save this checklist and choose one item to verify this week.
>
> GEM's bounded Business Security & Operations Review helps qualified small businesses identify priorities and next actions. It is not a certification, destructive test, or guarantee of protection.
>
> Request a review through the link in the authorized GEM profile. No service is activated by an inquiry.

**Design/accessibility:** 1080×1350 slides, high-contrast text, one idea per slide, minimum readable body type, descriptive text for every slide, and no text baked only into an image without an equivalent caption.

### Day 4 — X company account: practical five-post thread

**Post 1**  
Small-business security often begins with ordinary operating questions—not advanced tools.

**Post 2**  
Can you name the people who control your domain, business email, and account recovery methods?

**Post 3**  
Is MFA enabled on email, finance tools, and administrator accounts? Are routine user accounts separate from admin access where practical?

**Post 4**  
If a vendor leaves or payment instructions change, do you have a clear access-removal and second-channel verification process?

**Post 5**  
A checklist helps identify what to review first. GEM offers a bounded $199 Business Security & Operations Review for qualified businesses, subject to scope. It is not a certification or guaranteed monitoring service.  
**CTA:** use the tracked X Business Review link.

### Day 5 — Vertical video: use on TikTok, Reels, and Shorts after each account passes readiness

**Length:** 25–30 seconds. **Format:** 1080×1920, captions burned in and checked for accuracy.

- **0–3 sec, on-camera:** “If your business email stopped working tomorrow, would you know how to recover it?”
- **3–8 sec, overlay:** “Who controls your domain and recovery email?”
- **8–13 sec, overlay:** “Is MFA enabled on important accounts?”
- **13–18 sec, overlay:** “Are payment changes verified separately?”
- **18–23 sec, overlay:** “Have you tested your backups?”
- **23–30 sec, on-camera/brand end card:** “Start with the questions that matter. GEM's Business Security & Operations Review is a bounded, $199 first step for qualified businesses. Check the scope before requesting.”

**Video description**

> Four practical checks for business security readiness: recovery ownership, MFA, payment-change verification, and backups. GEM's review is subject to qualification and scope; it is not a certification or guarantee of continuous monitoring.

**Production controls:** Use an authorized spokesperson or approved non-identifying visuals, obtain appearance/music rights, include accurate captions, and do not show real client systems, credentials, security logs, or private information. Rendering a video is not authorization to publish it.

### Day 6 — Telegram: welcome post, only after the official channel is confirmed

**Post copy**

> Welcome to GEM's security and operational-readiness channel.
>
> We share practical guidance on account safety, scam awareness, business continuity, and how to identify sensible next steps.
>
> We will never ask you to post passwords, recovery codes, private keys, identity documents, or bank details in this channel. General questions are not service requests, and a message does not activate monitoring or incident response.
>
> For a qualified business seeking structured priorities, see GEM's Business Security & Operations Review. Please use the official tracked link, and submit sensitive information only through the approved process when specifically required.

**Publish gate:** A named GEM operator must confirm the official channel, bot ownership, channel/chat ID, administrator status, and successful authorized connector. Otherwise keep this as a draft.

### Day 7 — Individual/family lane: hold until the new route is live

**Post copy**

> Personal security can start with three useful habits:
>
> 1. Turn on multi-factor authentication for your main email and important accounts.  
> 2. Review recovery methods and remove ones you no longer control.  
> 3. Verify urgent money requests through a separate trusted channel instead of responding to the message alone.
>
> For families, review device updates, home Wi-Fi settings, and shared account access together.
>
> GEM is preparing a separate personal and family security pathway. Use the link only after the page is live and its contact flow has been tested. Do not put private account details in public comments.

**Publish gate:** Hold until PR #434 is merged under owner approval, the canonical deployment contains `/personal-security`, and the route plus CTA work in an actual browser.

## 5. Paid-ad package — creative prepared, delivery still blocked

The existing Ads Bridge is explicitly a **US-market, $199 USD, clicks-objective, paused, preview-only, USD $0** package. The variations below are copy drafts only; they do not activate an ad account or authorize spending.

### Variation A — readiness and priorities

- **Primary text:** “Know what to fix first. GEM's bounded Business Security & Operations Review helps qualified small businesses review access, public exposure, operational dependencies, and incident readiness. $199, subject to qualification and agreed scope.”
- **Headline:** “Know What to Fix First”
- **Description:** “A structured first review and prioritized action plan.”
- **CTA:** “Learn More”
- **Landing page:** existing canonical Business Review page.
- **Visual:** dark-navy/cyan checklist card; no fake alerts, breach claims, or certification marks.

### Variation B — operational continuity

- **Primary text:** “Would your business know how to recover its email, verify a payment change, and restore critical files? Start with a practical readiness review rather than assumptions.”
- **Headline:** “Start With a Clearer Plan”
- **Description:** “Scope and eligibility confirmed before engagement.”
- **CTA:** “Learn More”
- **Visual:** simple three-panel concept: account recovery, payment verification, backup restoration.

### Variation C — owner/operator audience

- **Primary text:** “For small teams, account access and operational dependencies matter. GEM's $199 founding Business Security & Operations Review helps qualified businesses identify priorities for the next 30 days. Not a penetration test or certification; scope is confirmed first.”
- **Headline:** “A Practical First Security Review”
- **Description:** “A bounded review for qualified small businesses.”
- **CTA:** “Learn More”
- **Visual:** business-owner working through a short checklist; any person or stock asset must be licensed.

**Paid launch cannot be enabled until the owner selects the market and budget, confirms advertiser/business account ownership and billing, approves final creative and audience, and authorizes the platform activation.** Do not turn a missing permission into a green readiness flag.

## 6. Social connector readiness: what is and is not connected

The repository supports these lanes, but that is not evidence that their provider accounts are authorized or production-ready.

| Connector | Requirements before first public post | Current stance |
|---|---|---|
| Facebook Page / Instagram Professional | Meta app config, approved permissions/app review where required, explicit Page/Professional account selection, consent/scopes, working gateway storage, per-provider gate | Blocked until evidenced |
| TikTok | Existing TokMetric authorization, account scope, token storage, production gateway transaction backend and schema, exact-version approval | Blocked; do not bypass TokMetric with a second connector |
| X | Company account, OAuth client/scopes and redirect URI, token storage and gateway readiness | Blocked until evidenced |
| LinkedIn Company | Authorized organization, organization-role validation, Community Management API access, scopes and gateway readiness | Blocked until platform access is evidenced |
| YouTube | Authorized channel/Brand Account, Google OAuth, applicable API audit/verification, media rights and gateway readiness | Blocked until evidenced |
| Telegram | Official bot token stored as an encrypted credential, verified channel/chat ID, bot administrator rights, gateway readiness | Blocked until operator setup and test |
| Nextdoor | Approved publishing API access, authorized business/neighborhood identity, documented local relevance, gateway readiness | Blocked until platform approval |
| Metricool | Login and each target social profile's authorization/permissions independently verified | Existing references are not proof of live publishing authorization |
| Paid ads | Advertiser identity, payment/billing, chosen positive budget, approved audience and creative, landing-path smoke test | Paused; $0 preview only |

The safe order is: **(1)** complete production persistence/gateway and migration verification; **(2)** connect one primary company account with an authorized operator; **(3)** test account discovery and credential storage without posting; **(4)** verify one approved draft, exact-version approval and compliance record; **(5)** authorize a controlled test post only after a separate owner decision; **(6)** verify external URL, asset, audit record and analytics before repeating on other channels.

## 7. Before scheduling or uploading

- [ ] Confirm an accountable operator has access to the official GEM company accounts.
- [ ] Verify the canonical production business review page, consent/privacy links, and one approved test submission/reference.
- [ ] Confirm each link opens the right route and retains expected attribution.
- [ ] Confirm the exact channel/account selected matches the GEM company identity.
- [ ] Approve the final copy, image/video rights, alt text/captions, and destination for the exact version.
- [ ] Confirm external publishing is intentionally enabled only for that provider after backend, platform, and connector checks pass.
- [ ] For ads, separately approve the target geography, budget, billing, campaign objective, and the final Ads Manager preview.
- [ ] Record post URL, time, content version, and attribution evidence after a real post succeeds.
- [ ] Review reach, qualified visits, completed requests, qualification rate, and cost per qualified lead—not impressions alone.

**Release note:** This file is an upload-ready content and review pack. It intentionally does not schedule, post, upload media to a social network, enable OAuth, activate billing, or change production configuration.


## 8. Creative files and structured campaign package

The repository now includes eight original editable vector assets and a structured JSON manifest. These are assets in the code repository; they have **not** been uploaded to an external social network or published.

- Square business-readiness creative: `/images/market-launch/gem-business-readiness-square.svg`
- Vertical story/reel/short creative: `/images/market-launch/gem-business-readiness-story.svg`
- Six-slide Instagram carousel:
  - `/images/market-launch/gem-readiness-carousel-01.svg`
  - `/images/market-launch/gem-readiness-carousel-02.svg`
  - `/images/market-launch/gem-readiness-carousel-03.svg`
  - `/images/market-launch/gem-readiness-carousel-04.svg`
  - `/images/market-launch/gem-readiness-carousel-05.svg`
  - `/images/market-launch/gem-readiness-carousel-06.svg`
- Structured draft manifest: `/market-launch/founding-first-20.json`
- Manifest regression test: `src/__tests__/market-launch-manifest.test.ts`

The manifest stores seven channel-specific draft captions, seven UTM-tracked business-review URLs, media references and alt text, plus explicit release gates. It intentionally marks every channel as `DRAFT`, requires owner approval, and preserves the existing Business Review route. Use the SVG files as editable source; before uploading to a provider that does not accept SVG, render them to the provider's required raster format and inspect the result at actual mobile size.


## 9. Current release checkpoint — 2026-10-15

The public business-review page is discoverable at `https://www.gemcybersecurityassist.com/business-review` and presents the bounded $199 offer and qualification form. The public resources index also exposes the business-readiness checklist. This confirms public page presence, **not** successful form submission, durable storage, email delivery, or a production deployment of this branch.

The repository's enterprise intake handler validates the submission, applies rate limiting and anti-bot checks, and calls the durable intake repository. If that store is unavailable, it is designed to return `503 INTAKE_STORAGE_NOT_READY`. A source-code review cannot establish that the live store is configured or that a real request was persisted.

### Release gate — must pass before the first promotional post

1. **Deployment identity:** identify the existing Vercel project serving `gemcybersecurityassist.com` and verify its Git commit. Do not create a replacement project.
2. **Intake acceptance:** submit one clearly labelled owner-controlled test request through the live form; record its reference and verify it appears in the authorized qualification queue. Confirm no duplicate record on refresh/retry.
3. **Contact and privacy:** confirm the live privacy link, consent wording, and a working monitored contact route.
4. **Attribution:** open the LinkedIn campaign URL from the manifest and verify the form retains the expected UTM/campaign fields in the resulting record.
5. **Rollback and ownership:** identify who receives new requests and who can pause the campaign if intake fails.

### Current stop conditions

- The connected Vercel integration previously returned HTTP 403 when listing the known production project/team. Until access is restored, the deployment and environment configuration cannot be independently verified from this workflow.
- Do not merge this draft-only PR solely to bypass the access issue; verify the canonical project's actual branch and release controls first.
- Do not publish through the social automation console or enable paid delivery until the transactional publishing gateway, provider authorization/scopes, and owner approval are independently verified.
- The individual/family route remains a separate release gate; do not advertise it until its route is present in the canonical production build and smoke-tested.

**Decision:** the business content pack is prepared, and the public landing page is present. First promotional publication is **not yet release-cleared** until the live intake test and deployment identity checks above are evidenced.
