# GEM Video Storylines Runbook

Production renders use **licensed human-recorded narration**. The renderer does not synthesize a voice. The video footage illustrates the project while a consistent narrator explains the scenes and verified GEM services.

## Flow

| Step | Component | Production rule |
|---|---|---|
| Storyline and narration script | `content/video-storylines/gem-storylines.v1.json` | Approved script is the source of truth |
| Video footage | Pexels API | Licensed stock B-roll; never imply stock talent are GEM staff or clients |
| Narration | Human voice-over recording | One WAV file per beat; no synthetic voice fallback |
| Edit, captions, branding, variants | ffmpeg + libass | Captions follow the approved narration script |
| Runner | GitHub Actions `video-storylines.yml` | Scheduled render stays disabled until explicitly enabled |
| Review | Workflow artifact `gem-video-drafts-<run>` (14 days) | Draft only; no automatic publishing |

## Voice recording handoff

For each storyline, place the licensed voice artist's recordings in:

```
voice-recordings/<storyline-id>/
  beat00.wav
  beat01.wav
  beat02.wav
  ...
```

Use mono or stereo WAV audio. Each file must contain the narration for the matching beat in the JSON library, in order. Record the same narrator and delivery style across the GEM campaign. Obtain permission for commercial advertising, paid promotion, editing, and distribution on GEM's intended channels before using the recordings. Keep the signed license/usage permission with the production records; do not commit contracts or personal contact details to the repository.

The workflow checks that the recording folder exists; the renderer then checks every required beat file and audio stream. Missing recordings fail closed. Do not substitute an AI voice and do not claim a synthetic voice is a human recording.

## Outputs per storyline

| File | Size | Destinations |
|---|---|---|
| `<id>.vertical_9x16.mp4` | 1080×1920 | TikTok, Instagram Reels, Facebook Reels, YouTube Shorts, Telegram |
| `<id>.feed_4x5.mp4` | 1080×1350 | Instagram feed, Facebook feed |
| `<id>.landscape_16x9.mp4` | 1920×1080 | X, LinkedIn, YouTube |
| `manifest.json` | — | SHA-256 per file, clip credits, disclosures, validation result |

All files are H.264 High / yuv420p / 30 fps / AAC 48 kHz stereo, `+faststart`, loudness −14 LUFS, at most 60 s and 512 MB. A render that fails validation exits non-zero and is not eligible for approval.

## Activation

1. Obtain a free Pexels API key from pexels.com/api and add it as the repository secret `PEXELS_API_KEY`.
2. Add the licensed voice WAVs under `voice-recordings/<storyline-id>/`.
3. Enable repository variable `GEM_STORYLINES_RENDER_ENABLED=true` only when both inputs are ready.
4. Run **Actions → Video Storylines → Run workflow**, selecting the storyline ID, to produce draft variants.

Never put API keys in source files, issues, workflow artifacts, or chat.

## Rules

- Pexels footage only. Follow the Pexels License and do not imply talent or brands endorse GEM.
- People in stock footage are stock talent, never GEM staff, clients, or endorsers.
- No fabricated testimonials, SLAs, certifications, response times, guarantees, or customer outcomes.
- Narration must describe only the footage and GEM capabilities that have been verified.
- Captions currently follow the approved script; they are not speech-recognition transcripts. Verify the voice recording reads the approved script accurately before approval.
- Exact-version approval is required before any publish. This workflow never publishes.

## Local test

```bash
python3 -I scripts/video-storylines/render.py --storyline gem-master-one-controlled-path --offline --out out
```

Offline mode uses generated footage and tone audio. Its manifest is marked `OFFLINE_TEST_NOT_PUBLISHABLE`.

## Phase 2

Ingest approved renders into `Content` / `ApprovalRequest` through the trusted render-worker upload path (`VIDEO_RENDER_CALLBACK_SECRET`) once the canonical-lineage restore and its migrations are live.
