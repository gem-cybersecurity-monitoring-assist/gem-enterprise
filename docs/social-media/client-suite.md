# GEM Social Media Suite

## Purpose

`/app/social-media` is the authenticated website workspace for GEM clients and authorized team members. It is separate from the administrator Command Center.

## Website management surfaces

- `/app/social-media` — overview and publishing lifecycle
- `/app/social-media/accounts` — business account and destination authorization
- `/app/social-media/content` — cross-platform content production
- `/app/social-media/video` — governed rendering handoff, authorized asset library, private preview, checksum-bound local-file verification, and exact-version TikTok distribution
- `/app/social-media/tokmetric` — full TikTok and TikTok Shop operating page
- `/app/social-media/approvals` — compliance and exact-version human approval
- `/app/social-media/calendar` — scheduling and publishing preparation
- `/app/social-media/analytics` — source-labeled performance and learning

## Administrative boundary

`/app/command-center` is restricted to `admin`, `super_admin`, and `internal` roles. It remains the control plane for provider application configuration, secret management, certification evidence, emergency locks, platform-wide health, and production activation.

The client suite reuses governed GEM services and does not create a second publishing system. Account connection, content generation, compliance, human approval, scheduling, and external publishing remain separate recorded stages.

## Safety contract

- No account password collection; use provider authorization flows.
- No external publication merely because an account is connected.
- No publication before compliance and exact-version human approval.
- No bypass of connector health, idempotency, provider restrictions, or production gates.
- Indeed content is limited to genuine vacancies or approved employer updates.
- Analytics values retain source labels and unknown values are not estimated silently.
