# Live virtual team presenter

Owner: Codex / live-presenter-controller lane, 2026-10-11.
Base: 9f1da4f0921ff44b9f895dd911075aba972514ad.
Owned files: ops/gem-live-presenter/** and this task contract only.
Exclude existing video render jobs, social publishing, auth, Prisma, other PRs,
production activation, provider secrets, paid plans and merge.

User outcome: choose any authorized virtual team member from multiple uploaded
images, a custom voice and independent background. The operator's live words,
expressions and full-body actions drive the outgoing character during a two-way
customer call. The uploaded recording is a quality reference only.

Controller slice: enforce required renderer capabilities, independent transformed
audio/video, valid profiles, output freshness, neutral slate/silence on failure,
and safe start/stop. No renderer is supplied by this slice.

Release acceptance: real motion renderer and voice converter, camera/GPU check,
multiple-profile import UI, exact outgoing preview, virtual device bridge, and
separate two-client Zoom/Teams/WhatsApp compatibility tests. Measure frame rate,
end-to-end delay, lip synchronization and stability for a 30-minute session.
Targets to validate (not achieved claims): 720p/30fps minimum, 1080p when hardware
permits, added processing delay below 300ms and audio/video skew below 80ms.
Check supported gestures and full-body framing explicitly. A still image may
require additional references or rigging; do not promise arbitrary unseen poses.

Private source media stays on the media host by default. Do not record calls by
default. Use virtual team disclosure and authorized assets. Never expose source
camera or microphone automatically when processing fails. No queued clip can be
reported as a live call.

Status: controller implementation only; live acceptance blocked by offline host
and missing verified renderer/voice/device adapters. Rollback: remove isolated
ops/gem-live-presenter files; no platform routes or persisted data are changed.
