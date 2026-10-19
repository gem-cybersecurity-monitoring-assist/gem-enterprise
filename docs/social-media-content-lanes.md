# GEM Social Content Lanes

## Purpose

The Social Media Command Center has one governed orchestration system with two distinct production lanes plus the existing standard cross-platform lane. These lanes share the same source evidence, compliance review, exact-version approval, media-rights checks, publishing queue, connector health, live gates, audit evidence, and performance feedback.

The lanes are not interchangeable. The routing guard records the lane on the renderer recipe and blocks a content item before queue creation when its destination does not match the lane.

## Lane 1 — TikTok Viral Intelligence / Repurposing

Canonical lane id:

`TIKTOK_VIRAL_REPURPOSE`

Use this lane when a fresh market signal destined for TikTok comes from X or Threads.

Operational flow:

```text
X / Threads source
  ↓
source-reference classification
  ↓
freshness + editorial relevance
  ↓
summary
  ↓
material rewrite into GEM voice
  ↓
original TikTok-native hook / visuals / narration
  ↓
source attribution retained in metadata
  ↓
claims + rights + disclosure review
  ↓
exact-version approval
  ↓
TokMetric TikTok controls
  ↓
performance feedback
```

Required controls:

- The original X or Threads source reference remains attached for verification and attribution.
- Source wording, screenshots, post layout, profile presentation, and platform chrome must not be copied as the new creative.
- The generated piece must materially transform the source into original GEM commentary, explanation, visuals, narration, and calls to action.
- Fabricated statistics, fabricated events, deceptive documentary footage, impersonation, and unsupported claims remain prohibited.
- The lane's primary and only automatic destination is TikTok. A request to reuse the result elsewhere must create a separate destination-specific draft rather than silently rerouting the TikTok version.

## Lane 2 — Faceless AI Cinematic Production

Canonical lane id:

`FACELESS_CINEMATIC`

This is a separate, explicitly requested production lane for YouTube video content. Ordinary YouTube drafts remain in the standard governed lane unless a market signal or manual request carries the `FACELESS_CINEMATIC` lane hint. It does not replace the X/Threads-to-TikTok flow.

Operational flow:

```text
approved concept / current signal
  ↓
original script and storyboard
  ↓
faceless cinematic scene plan
  ↓
narration / TTS without real-person imitation
  ↓
generated or licensed visuals and soundtrack
  ↓
captions + accessibility
  ↓
AI-generated / synthetic-content disclosure metadata
  ↓
claims + rights + impersonation review
  ↓
exact-version approval
  ↓
YouTube publishing controls
  ↓
performance feedback
```

Required controls:

- No real-person impersonation or cloned real-person voice without an independently approved rights path.
- Do not present fabricated events as authentic footage or news.
- Preserve the destination's AI-generated or synthetic-content disclosure when required.
- Use only generated, owned, or properly licensed visuals, voices, music, and media.
- The primary destination is YouTube. TikTok adaptation is a separate draft and must pass the TikTok lane's own checks rather than reusing the YouTube object unchanged.
- Do not automatically convert all YouTube content into faceless production; the lane requires an explicit `FACELESS_CINEMATIC` request/hint.

## Standard governed lane

Canonical lane id:

`STANDARD_GOVERNED`

Existing Facebook Page, Instagram Professional, X, LinkedIn Company, Nextdoor, Indeed Employer, and ordinary governed content continue through the current provider-specific rules when neither special lane applies.

## Routing metadata

Each generated video recipe now carries:

- `contentLane`
- `sourceKind`
- `routingPolicyVersion`
- `aigcDisclosureRequired`
- `sourceTransformationRequired`
- `sourceAttributionRequired`
- `originalConceptRequired`

The source-evidence record also stores the source kind and transformation/attribution requirements.

## Queue guard and monitoring

Before the shared Social Autopilot creates a publishing job, it reads the lane metadata and validates the destination.

Examples:

- `TIKTOK_VIRAL_REPURPOSE` → YouTube: blocked.
- `FACELESS_CINEMATIC` → TikTok: blocked.
- `TIKTOK_VIRAL_REPURPOSE` without an X or Threads source: blocked.
- legacy content without lane metadata: treated as `STANDARD_GOVERNED` for backward compatibility.

Blocked reasons are recorded in the existing Social Autopilot audit summary. Lane, source kind, and routing-policy version are also copied into publishing-job metadata for downstream monitoring.

## Relationship to provider connectors

This work does not create a second scheduler or provider connector.

- TikTok continues through TokMetric.
- X remains a governed source/destination in the existing shared social foundation.
- YouTube remains in the existing shared provider foundation and keeps its current upload-certification gate.
- The global and provider-specific publishing locks remain unchanged.
- No credential, billing, ad-spend, or provider-live gate is enabled by this content-lane implementation.
