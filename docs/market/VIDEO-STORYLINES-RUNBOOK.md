# Video Storylines Runbook

Daily pipeline that turns the tagged storyline library into platform-ready draft videos at zero cost.

## Flow

| Step | Component | Cost |
|---|---|---|
| Storyline (beats, captions, voiceover, clip IDs) | `content/video-storylines/gem-storylines.v1.json` | â€” |
| Real-person footage | Pexels API, vertical clips, Pexels License | Free (20,000 requests/month) |
| Voiceover | Kokoro-82M (Apache-2.0), CPU | Free; synthetic voice, must be labeled |
| Edit, captions, branding, variants | ffmpeg + libass | Free |
| Runner | GitHub Actions `video-storylines.yml`, daily 05:39 Lagos | Free tier minutes |
| Review | Workflow artifact `gem-video-drafts-<run>` (14 days) â†’ Approvals | â€” |

## Outputs per storyline

| File | Size | Destinations |
|---|---|---|
| `<id>.vertical_9x16.mp4` | 1080Ã—1920 | TikTok, Instagram Reels, Facebook Reels, YouTube Shorts, Telegram |
| `<id>.feed_4x5.mp4` | 1080Ã—1350 | Instagram feed, Facebook feed |
| `<id>.landscape_16x9.mp4` | 1920Ã—1080 | X, LinkedIn, YouTube |
| `manifest.json` | â€” | SHA-256 per file, clip credits, disclosures, validation result |

All files are H.264 High / yuv420p / 30 fps / AAC 48 kHz stereo, `+faststart`, loudness âˆ’14 LUFS, at most 60 s and 512 MB. A render that fails validation exits non-zero and is not eligible for approval.

## Activation

1. Create a free key at pexels.com/api.
2. Add it as the repository secret `PEXELS_API_KEY` (Settings â†’ Secrets and variables â†’ Actions). Never paste it into code, issues or chat.
3. Add repository variable GEM_STORYLINES_RENDER_ENABLED=true only after the key is present. Scheduled renders remain skipped until this switch is enabled.
3. Run **Actions â†’ Video Storylines â†’ Run workflow** (optionally with a storyline id) to produce the first drafts.

## Rules (enforced in content and review)

- Pexels footage only. Mixkit is excluded because part of its catalogue is personal-use only.
- People on screen are stock talent; never caption them as GEM clients, staff or endorsers.
- No identifiable person in a negative light; threat beats use masked or faceless footage.
- No SLAs, certifications, response times or guarantees.
- The current renderer uses a synthetic Kokoro voice. It is not a human recording; the manifest marks it as synthetic and platform AI-content labels must be applied where required. Do not represent it as a live GEM spokesperson.
- Exact-version approval is required before any publish. This workflow never publishes.

## Local test

```bash
python3 -I scripts/video-storylines/render.py --storyline gem-master-one-controlled-path --offline --out out
```

Offline mode uses generated footage and tone audio; its manifest is marked `OFFLINE_TEST_NOT_PUBLISHABLE`.

## Phase 2

Ingest approved renders into `Content` / `ApprovalRequest` through the trusted render-worker upload path (`VIDEO_RENDER_CALLBACK_SECRET`) once the canonical-lineage restore and its migrations are live.

