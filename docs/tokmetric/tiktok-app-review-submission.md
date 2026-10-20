# TikTok App Review Submission — Alliance-Trust Hub / TokMetric

## Copy for “Explain how each product and scope works”

Use this text in the TikTok review form. It is under the 1,000-character limit:

> Alliance-Trust Hub uses TikTok Login Kit so a user can connect their own TikTok account through TikTok OAuth. The `user.info.basic` scope is used to show the connected creator username and nickname. TokMetric uses the Content Posting API with `video.publish` only after the user selects an approved video, refreshes the creator settings, edits the caption, chooses one of TikTok’s returned privacy options, configures comments/Duet/Stitch and commercial or AI-content disclosures, confirms video and music rights, and expressly clicks “Send video to TikTok.” Local files upload directly from the user’s browser to TikTok’s temporary upload URL. The app then polls TikTok’s status endpoint and shows processing, success, or failure. TikTok passwords and access tokens are never displayed or stored in the browser. Sandbox demonstrations use `SELF_ONLY` privacy.

## Products to select

Select only the products demonstrated in the recording:

- Login Kit
- Content Posting API — Direct Post

Do not select Display API, Share Kit, TikTok Shop, Business API, or advertising products unless the submitted recording demonstrates those products end to end.

## Scopes to request

- `user.info.basic`
- `video.publish`

Do not request `video.upload` for this Direct Post review flow. `video.upload` is used for the separate upload-to-inbox/draft experience and is not required by the implemented Direct Post workflow.

## Demo video recording sequence

Record one continuous MP4 or MOV video showing:

1. The browser address bar displaying the verified GEM domain.
2. Sign-in to the GEM Enterprise review account.
3. Open `/tokmetric/publishing`.
4. Select the review workspace.
5. Select the connected TikTok sandbox account.
6. Select an approved content record and its exact approved media asset.
7. Wait for the creator settings to load automatically (TikTok requires a fresh creator-info query whenever the post page renders; **Refresh creator settings** re-queries on demand).
8. Show the returned TikTok avatar, nickname, username, maximum duration, and privacy options.
9. Select the local MP4/MOV/WebM file that is the exact approved asset, and show the checksum-match confirmation.
10. Edit the caption.
11. Choose `SELF_ONLY` for sandbox review.
12. Show the comments, Duet, Stitch, paid-partnership, own-business, and AI-generated-content controls. Toggle the commercial disclosure on with nothing selected to show the disabled publish button and the required prompt, then select **Your brand** to show the “Promotional content” label preview.
13. Manually check all four consent and rights confirmations.
14. Click **Send video to TikTok**.
15. Show upload progress.
16. Show TikTok processing status in TokMetric.
17. Open the authorized TikTok sandbox/test account and show the resulting private post after processing completes.
18. Briefly show the public Privacy Policy and Terms of Service pages.

The recording must show real clicks and a real sandbox API request. Do not submit only static mockups or narrated slides.

## Before clicking “Submit for review”

- The review account can sign in successfully.
- The review workspace has `publishingDisabled=false`.
- The content item has an approved current version and matching approval hash.
- The Content Posting connector is `CONNECTED` and carries `user.info.basic` and `video.publish`.
- `TIKTOK_ENVIRONMENT=sandbox`.
- `TOKMETRIC_TIKTOK_OAUTH_ENABLED=true`.
- `TOKMETRIC_SANDBOX_PUBLISHING_ENABLED=true`.
- `TOKMETRIC_LIVE_PUBLISHING_ENABLED=false`.
- The redirect URI exactly matches the TikTok Developer Portal value.
- The uploaded demo file is MP4 or MOV. The review form's instructions state 50 MB per file, but its upload widget currently states 5 MB per file; compress or split into up to three clips to satisfy the stricter limit.
