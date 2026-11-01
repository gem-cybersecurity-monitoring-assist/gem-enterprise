# GEM Video Storylines Runbook

Human-recorded WAV narration remains the renderer's default. The scheduled workflow explicitly opts into Kokoro synthetic narration; manifests disclose synthetic voice and AI-generated content. Pixabay footage illustrates the project while a consistent narrator explains verified GEM services.

## Flow

| Step | Component | Production rule |
|---|---|---|
| Storyline and narration script | `content/video-storylines/gem-storylines.v1.json` | Approved script is the source of truth |
| Video footage | Pixabay API | Licensed stock B-roll; never imply stock talent are GEM staff or clients |
| Narration | Human WAV by default; Kokoro when explicitly enabled | Workflow synthetic mode is disclosed in the manifest |
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

To use human narration, pass --voice-dir and provide one WAV per beat. The workflow currently opts into Kokoro with --synthetic-voice. Never claim synthetic narration is human-recorded.

## Outputs per storyline

| File | Size | Destinations |
|---|---|---|
| `<id>.vertical_9x16.mp4` | 1080×1920 | TikTok, Instagram Reels, Facebook Reels, YouTube Shorts, Telegram |
| `<id>.feed_4x5.mp4` | 1080×1350 | Instagram feed, Facebook feed |
| `<id>.landscape_16x9.mp4` | 1920×1080 | X, LinkedIn, YouTube |
| `manifest.json` | — | SHA-256 per file, clip credits, disclosures, validation result |

All files are H.264 High / yuv420p / 30 fps / AAC 48 kHz stereo, `+faststart`, loudness −14 LUFS, at most 60 s and 512 MB. A render that fails validation exits non-zero and is not eligible for approval.

## Activation

1. Sign in to Pixabay, open https://pixabay.com/api/docs/, and copy the API key shown on the page. Add it as the repository Actions secret `PIXABAY_API_KEY`; never put it in source, issues, artifacts, or chat. Rotate any key exposed in chat.
2. Add the licensed voice WAVs under `voice-recordings/<storyline-id>/`.
3. Enable repository variable `GEM_STORYLINES_RENDER_ENABLED=true` only when both inputs are ready.
4. Run **Actions → Video Storylines → Run workflow**, selecting the storyline ID, to produce draft variants.

Never put API keys in source files, issues, workflow artifacts, or chat.

The renderer caches Pixabay API search responses for 24 hours, records each source page and contributor in the manifest, prefers portrait clips, and uses landscape clips only as a crop fallback. Pixabay's Content License permits commercial use subject to prohibited-use restrictions. Check releases and third-party rights for identifiable people, trademarks, logos, and property before advertising use.

## Rules

- Pixabay footage only. Follow the Pixabay License and do not imply talent or brands endorse GEM.
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
