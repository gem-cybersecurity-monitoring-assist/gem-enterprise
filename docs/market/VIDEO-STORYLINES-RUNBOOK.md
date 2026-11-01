# GEM Video Storylines Runbook

Production video drafts use licensed stock B-roll from the **Pixabay Video API by default**. Pexels remains an optional provider when a valid `PEXELS_API_KEY` is configured. Narration uses the existing Kokoro TTS engine only when `--synthetic-voice` is explicitly enabled; otherwise the renderer requires licensed human WAV recordings. Every synthetic narration render is marked as AI-generated in its manifest and must carry TikTok's AI-generated-content label when approved for publication.

## Flow

| Step | Component | Production rule |
|---|---|---|
| Storyline and narration script | `content/video-storylines/gem-storylines.v1.json` | Approved script is the source of truth |
| Video footage | Pixabay Video API (default), Pexels optional | Portrait stock B-roll; source page and creator are recorded in the manifest |
| Narration | Human WAV recordings by default; opt-in Kokoro TTS | Synthetic voice is disclosed as `synthetic_kokoro` and `aiGeneratedContent: true` |
| Edit, captions, branding, variants | ffmpeg + libass | Captions follow the approved narration script |
| Runner | GitHub Actions `video-storylines.yml` | Scheduled render stays disabled until explicitly enabled |
| Review | Workflow artifact `gem-video-drafts-<run>` (14 days) | Draft only; no automatic publishing |

## Pixabay API and caching

1. Create a Pixabay account and obtain an API key from the [Pixabay API documentation](https://pixabay.com/api/docs/).
2. Store the key as the GitHub Actions repository secret `PIXABAY_API_KEY`. Never place API keys in source files, issues, workflow artifacts, or chat.
3. The workflow restores and saves `.cache/pixabay/` between runs. Search responses are cached for at least 24 hours, as required by Pixabay's API documentation.
4. The renderer searches using each storyline clip title as a relevance hint, then falls back to the storyline theme and beat role. It filters for portrait MP4 variants, downloads the selected clip, and records the actual Pixabay video ID, source page and creator in `manifest.json`.
5. Keep one storyline per workflow run. Do not run systematic bulk-download jobs; Pixabay's API terms restrict automated mass collection.

Pixabay's API defaults to 100 requests per 60 seconds. The renderer caches searches for 24 hours, performs only a small number of per-beat searches, and fails closed if no suitable portrait result is returned. Review each selected clip for recognisable people, trademarks, logos and any additional rights before approving a draft. Pixabay's Content License permits free use and adaptation subject to its prohibited-use rules; the full licence, not the summary, is legally binding.

## Pexels optional provider

Pexels remains available for accounts that already have a valid Pexels API key:

```bash
PEXELS_API_KEY=... python3 -I scripts/video-storylines/render.py \
  --storyline <id> --stock-provider pexels --out out
```

The default `--stock-provider auto` selects Pixabay when `PIXABAY_API_KEY` is present, otherwise it selects Pexels when `PEXELS_API_KEY` is present. The workflow explicitly selects Pixabay.

## Narration

Human WAV recordings remain the default. For a storyline, place licensed voice recordings in:

```
voice-recordings/<storyline-id>/
  beat00.wav
  beat01.wav
  beat02.wav
  ...
```

Use mono or stereo WAV audio, one file per beat, in the same order as the storyline JSON. Obtain permission for commercial advertising, paid promotion, editing and distribution on GEM's intended channels. Keep signed usage permissions with production records; do not commit contracts or personal contact details.

For automated narration, explicitly pass `--synthetic-voice` and optionally `--voice af_heart` (or another supported Kokoro voice):

```bash
PIXABAY_API_KEY=... python3 -I scripts/video-storylines/render.py \
  --storyline gem-cyber-qr-code-trap --stock-provider pixabay \
  --synthetic-voice --voice af_heart --out out
```

Synthetic narration is disclosed in `manifest.json`:

- `disclosures.syntheticVoice: true`
- `disclosures.voiceType: "synthetic_kokoro"`
- `disclosures.aiGeneratedContent: true`

The TokMetric Direct Post path reads this disclosure from the approved version/media metadata and forces TikTok's AI-generated-content label on. Do not manually disable that label for a synthetic render.

## Outputs per storyline

| File | Size | Destinations |
|---|---|---|
| `<id>.vertical_9x16.mp4` | 1080×1920 | TikTok, Instagram Reels, Facebook Reels, YouTube Shorts, Telegram |
| `<id>.feed_4x5.mp4` | 1080×1350 | Instagram feed, Facebook feed |
| `<id>.landscape_16x9.mp4` | 1920×1080 | X, LinkedIn, YouTube |
| `manifest.json` | — | SHA-256 per file, actual stock clip credits, disclosures, validation result |

All files are H.264 High / yuv420p / 30 fps / AAC 48 kHz stereo, `+faststart`, loudness −14 LUFS, at most 60 s and 512 MB. A render that fails validation exits non-zero and is not eligible for approval.

## Activation

1. Add `PIXABAY_API_KEY` as a GitHub Actions repository secret.
2. Confirm the desired narration mode: human WAV recordings by default, or Kokoro via the workflow's explicit synthetic-voice flag.
3. Enable repository variable `GEM_STORYLINES_RENDER_ENABLED=true` only when the API secret and review process are ready.
4. Run **Actions → Video Storylines → Run workflow**, selecting one storyline ID, to produce a draft artifact.

The workflow is gated by `GEM_STORYLINES_RENDER_ENABLED`, uploads draft artifacts only, and never publishes. Exact-version approval remains required before a separate publishing flow can act.

## Rules

- Pixabay is the default stock-video provider; Pexels is optional. The actual provider, source page, video ID and creator are recorded in the manifest.
- Follow the selected provider's licence. Do not imply stock talent or brands endorse GEM.
- People in stock footage are stock talent, never GEM staff, clients or endorsers.
- No fabricated testimonials, SLAs, certifications, response times, guarantees or customer outcomes.
- Narration must describe only the footage and GEM capabilities that have been verified.
- Captions follow the approved script; they are not speech-recognition transcripts. Verify the generated narration and footage before approval.
- Exact-version approval is required before any publish. This workflow never publishes.

## Local test

```bash
python3 -I scripts/video-storylines/test_pixabay.py
python3 -I scripts/video-storylines/render.py \
  --storyline gem-master-one-controlled-path --offline --out out
```

Offline mode uses generated footage and tone audio. Its manifest is marked `OFFLINE_TEST_NOT_PUBLISHABLE`.

## Phase 2

Ingest approved renders into `Content` / `ApprovalRequest` through the trusted render-worker upload path (`VIDEO_RENDER_CALLBACK_SECRET`) once the canonical-lineage restore and its migrations are live.
