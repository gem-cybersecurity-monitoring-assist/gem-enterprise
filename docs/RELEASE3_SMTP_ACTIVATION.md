# Release 3 SMTP Activation

This runbook completes GitHub issue #200 after a new restricted provider credential and sender-domain verification are available.

## Production-only variables

Configure these in the canonical Vercel project production environment:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `REPLY_TO_EMAIL`
- `NEXT_PUBLIC_APP_URL`

`SMTP_FROM` must use the verified `gemcybersecurityassist.com` sender. `NEXT_PUBLIC_APP_URL` must remain the canonical HTTPS origin.

Never reuse the historical exposed SendGrid credential. Never place credentials in GitHub, issue comments, deployment logs, URLs, or browser-visible variables.

## Safe verification order

1. Confirm sender and domain verification with the provider.
2. Add the new restricted credential only to Vercel Production.
3. Deploy current `main` and wait for the exact production deployment to reach `READY`.
4. Read `/api/auth/recovery-readiness` and confirm `emailDeliveryConfigured` is `true`.
   - Anonymous and non-admin callers receive only `ok`, `service`, `emailDeliveryConfigured` and `detailsRequireAdministrator`.
   - While signed in as a GEM administrator, the same endpoint also returns `emailDelivery`; confirm `missingVariables` is empty and the port and secure settings are valid.
5. While authenticated as a GEM administrator, POST to `/api/auth/recovery-readiness/verify`.
   - This performs an SMTP handshake only.
   - It sends no message.
   - It returns no credential value or provider response text.
6. Submit one controlled forgot-password request for the canonical administrator account.
7. Confirm provider acceptance and receipt of the canonical fragment-based reset link.
8. Do not complete the reset during delivery validation.
9. Inspect production error and fatal logs.
10. Reconfirm the Release 3 session-version column, revocation triggers, and function privileges.

## Completion evidence

Record only:

- deployment ID and commit SHA
- readiness result
- transport verification code
- provider delivery event identifier with sensitive fields removed
- reset-link origin and expiry policy
- clean runtime-log result
- unchanged session-revocation controls

Do not record the reset token, SMTP password, provider API key, or full message headers.
