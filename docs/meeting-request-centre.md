# GEM Meeting Request Centre

## Implemented flow

- Admin-only recipient directory: GET /api/meetings/recipients.
- Admin creates a meeting for selected active users in the same organization: POST /api/meetings.
- Meeting and invitee records are persisted in PostgreSQL.
- If Zoom Server-to-Server OAuth credentials are configured, GEM creates a scheduled Zoom meeting and stores its join/start URLs.
- If SMTP is configured, selected invitees receive an email invitation.
- Admin meeting page shows invitees and attendance status.
- Zoom participant webhooks update invitee status when Zoom supplies a matching participant email.

## Required configuration

Set these server-side environment variables in the deployment environment (never expose them as NEXT_PUBLIC variables):

- ZOOM_ACCOUNT_ID
- ZOOM_CLIENT_ID
- ZOOM_CLIENT_SECRET
- ZOOM_WEBHOOK_SECRET_TOKEN
- SMTP_HOST
- SMTP_PORT (587 or 465)
- SMTP_USER
- SMTP_PASS
- EMAIL_FROM

The Zoom app must be an authorized Server-to-Server OAuth app with meeting creation permissions, including meeting:write:admin or the corresponding account-level scope available in the Zoom app configuration.

Configure the Zoom Event Subscription webhook URL as:

https://YOUR_GEM_DOMAIN/api/meetings/zoom-webhook

Subscribe to endpoint.url_validation, meeting.participant_joined, and meeting.participant_left. Zoom webhook delivery must be enabled and the webhook secret token must match ZOOM_WEBHOOK_SECRET_TOKEN.

## Database rollout

A Prisma migration was added at:
prisma/migrations/20261103000100_meeting_invitation_centre/migration.sql

Review it against the target database backup, then deploy with the project's normal migration workflow. Do not use prisma db push against production as an unreviewed shortcut.

## Preconditions / limitations

- Admin accounts must have organizationId set.
- Team members must be active User records in the same organization.
- No Zoom or SMTP credentials were found in the inspected local project environment; the repository had .env.example only. Real Zoom creation and email delivery therefore remain unconfigured until secrets are added to the deployment environment.
- Participant matching currently relies on the participant email supplied by Zoom. Zoom may omit participant email depending on account authentication and meeting settings; those participants will not be matched automatically until an approved identity mapping is implemented.
- Joining a Zoom call does not start remote device monitoring, screen viewing, or control. Endpoint operations remain separately authorized and auditable.
