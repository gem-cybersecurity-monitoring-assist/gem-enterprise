# TokMetric media publishing

## Implemented flow

TokMetric supports a governed end-to-end TikTok video publishing workflow:

1. An authenticated operator selects a TokMetric workspace.
2. The operator selects a connected TikTok Content Posting API account.
3. The operator selects an approved content version and one of the video assets attached to that exact version.
4. TokMetric queries TikTok's latest creator information before rendering publishing controls.
5. The operator chooses one of the privacy levels returned for that creator.
6. The operator configures comments, Duet, Stitch, commercial-content disclosure, and AI-generated-content disclosure.
7. The operator explicitly confirms upload consent, video rights, music rights, and the TikTok processing notice.
8. TokMetric initializes the Direct Post request through TikTok's official Content Posting API.
9. A local MP4, MOV, or WebM file is accepted only when its browser-calculated SHA-256 checksum, MIME type, and file size match the selected approved asset, then it is uploaded directly from the browser to TikTok's temporary upload URL in sequential chunks.
10. A server-hosted video can use `PULL_FROM_URL` only from the selected approved asset's stored URL, when its hostname is included in `TOKMETRIC_VERIFIED_MEDIA_HOSTS` and has been verified in the TikTok Developer Portal. Operators cannot substitute another URL.
11. TokMetric polls the official post-status endpoint and records the internal and external state of the publishing job.
12. Operators can refresh the status until TikTok reports a final success or failure state.

TikTok cancellation is restricted to an ongoing `PULL_FROM_URL` download and is best-effort. Local file uploads and posts that have already entered processing are not presented as cancellable.

Access tokens, refresh tokens, client secrets, and TikTok upload URLs are never persisted in browser storage or returned through logs and audit metadata.

## Activation gates

Publishing remains fail-closed.

### Sandbox review

Set all of the following:

```text
TIKTOK_ENVIRONMENT=sandbox
TOKMETRIC_TIKTOK_OAUTH_ENABLED=true
TOKMETRIC_SANDBOX_PUBLISHING_ENABLED=true
TOKMETRIC_LIVE_PUBLISHING_ENABLED=false
```

Sandbox publishing is restricted by the application to `SELF_ONLY` privacy. The workspace must also have `publishingDisabled=false`, no global emergency lock, an approved content version, and a valid connector carrying `video.publish`.

### Production

Set:

```text
TIKTOK_ENVIRONMENT=production
TOKMETRIC_TIKTOK_OAUTH_ENABLED=true
TOKMETRIC_LIVE_PUBLISHING_ENABLED=true
TOKMETRIC_SANDBOX_PUBLISHING_ENABLED=false
```

Production activation should occur only after TikTok approves the required product and scopes and the app review is complete.

## Transfer modes

### FILE_UPLOAD

Use this mode when the video is on the user's device. The browser uploads the video directly to TikTok using the temporary upload URL returned by TikTok. TokMetric plans sequential chunks that follow TikTok's 5 MB minimum, 64 MB normal maximum, 128 MB final-chunk allowance, 1,000-chunk maximum, and 4 GB video maximum.

### PULL_FROM_URL

Use this mode only when the video already exists on server-side storage. Configure a comma-separated allowlist:

```text
TOKMETRIC_VERIFIED_MEDIA_HOSTS=gemcybersecurityassist.com,www.gemcybersecurityassist.com
```

Every configured domain or URL prefix must also be verified in the TikTok Developer Portal. URLs must be HTTPS, must not contain credentials or fragments, and must not redirect. An ongoing URL download may be cancelled through the restricted cancellation route until TikTok reports that it is no longer cancellable.

## Operational routes

- `GET /api/tokmetric/publishing/context`
- `POST /api/tokmetric/publishing/creator-info`
- `POST /api/tokmetric/publishing/init`
- `POST /api/tokmetric/publishing/upload-complete`
- `POST /api/tokmetric/publishing/status`
- `POST /api/tokmetric/publishing/cancel` — `PULL_FROM_URL` only

All routes require an authenticated TokMetric session, workspace access, and the `publish:content` permission where a workspace role is present.

All publishing mutations also require an active account and an explicit same-origin browser request. The publishing context omits approved content that has no attached supported video asset.

## Built-in website flow

The complete approved-video handoff is available inside GEM at `/app/social-media/video`. The page loads authorized workspaces and exact approved video assets, provides a private verified preview, and exposes the governed TikTok posting controls without embedding an external product. Content preparation and rendering remain at `/app/social-media/content`; exact-version review remains at `/app/social-media/approvals`.

## App review recording

Record the working flow on `/tokmetric/publishing` while the TikTok app is in sandbox mode:

1. Sign in to the GEM Enterprise demo account.
2. Open TokMetric Publishing.
3. Select the review workspace and connected sandbox TikTok account.
4. Select an approved content item.
5. Click **Query creator settings** and show the returned TikTok nickname and privacy options.
6. Select a local video file.
7. Edit the caption and choose `SELF_ONLY`.
8. Show comment, Duet, Stitch, paid-partnership, own-business, and AI-generated-content controls.
9. Check each consent and rights confirmation manually.
10. Click **Send video to TikTok**.
11. Show chunk-upload progress and the TikTok processing status.
12. Open the TikTok sandbox account and show the resulting private post when processing completes.

Do not submit a mockup-only recording. The review video should show real user interactions and a real sandbox publishing request.
