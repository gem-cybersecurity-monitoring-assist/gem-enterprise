# Video Storylines Runbook

Daily pipeline that turns the tagged storyline library into platform-ready draft videos at zero cost.

## Flow

| Step | Component | Cost |
|---|---|---|
| Storyline (beats, captions, voiceover, clip IDs) | `content/video-storylines/gem-storylines.v1.json` | — |
| Real-person footage | Pexels API, vertical clips, Pexels License | Free (20,000 requests/month) |
| Voiceover | Kokoro-82M (Apache-2.0), CPU | Free |
| Edit, captions, branding, variants | ffmpeg + libass | Free |
| Runner | GitHub Actions `video-storylines.yml`, daily 05:39 Lagos | Free tier minutes |
| Review | Workflow artifact `gem-video-drafts-<run>` (14 days) → Approvals | — |

## Outputs per storyline

| File | Size | Destinations |
|---|---|---|
| `<id>.vertical_9x16.mp4` | 1080×1920 | TikTok, Instagram Reels, Facebook Reels, YouTube Shorts, Telegram |
| `<id>.feed_4x5.mp4` | 1080×1350 | Instagram feed, Facebook feed |
| `<id>.landscape_16x9.mp4` | 1920×1080 | X, LinkedIn, YouTube |
| `manifest.json` | — | SHA-256 per file, clip credits, disclosures, validation result |

All files are H.264 High / yuv420p / 30 fps / AAC 48 kHz stereo, `+faststart`, loudness −14 LUFS, at most 60 s and 512 MB. A render that fails validation exits non-zero and is not eligible for approval.

## Activation

1. Create a free key at pexels.com/api.
2. Add it as the repository secret `PEXELS_API_KEY` (Settings → Secrets and variables → Actions). Never paste it into code, issues or chat.
3. Run **Actions → Video Storylines → Run workflow** (optionally with a storyline id) to produce the first drafts.

## Rules (enforced in content and review)

- Pexels footage only. Mixkit is excluded because part of its catalogue is personal-use only.
- People on screen are stock talent; never caption them as GEM clients, staff or endorsers.
- No identifiable person in a negative light; threat beats use masked or faceless footage.
- No SLAs, certifications, response times or guarantees.
- `manifest.disclosures.syntheticVoice` is true; apply each platform's AI-content label where its policy requires it.
- Exact-version approval is required before any publish. This workflow never publishes.

## Local test

```bash
python3 -I scripts/video-storylines/render.py --storyline gem-master-one-controlled-path --offline --out out
```

Offline mode uses generated footage and tone audio; its manifest is marked `OFFLINE_TEST_NOT_PUBLISHABLE`.

## Phase 2

Ingest approved renders into `Content` / `ApprovalRequest` through the trusted render-worker upload path (`VIDEO_RENDER_CALLBACK_SECRET`) once the canonical-lineage restore and its migrations are live.
