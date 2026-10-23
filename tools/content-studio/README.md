# Free video renderer for the trusted render worker

The governed video flow in [`docs/VIDEO_RENDER_WORKER.md`](../../docs/VIDEO_RENDER_WORKER.md) was built for a self-hosted ComfyUI machine. This folder supplies a free replacement for that machine, so the flow runs with no paid service and no server of your own:

```text
05:10 UTC  daily orchestrator → ≥ 20 TikTok drafts with video recipes (CONTENT_ORCHESTRATOR_MINIMUM_TIKTOK_ITEMS)
operator   Content Studio → "Produce all videos" → durable DISPATCHING render jobs
hourly     GitHub Actions "Video Render Worker":
             comfy_compat.py   ComfyUI-compatible API on 127.0.0.1:8188
             video:worker      existing worker, unchanged: lease → render → upload → verify → finalize
approval   a person approves each exact rendered version
publish    TokMetric TikTok controls (Direct Post), never automatic from this worker
```

| File | Role |
|---|---|
| `comfy_compat.py` | Implements the ComfyUI endpoints the worker uses (`/system_stats`, `/queue`, `/prompt`, `/history`, `/view`). Parses the recipe prompt written by `rendererPrompt()` back into scenes and renders it. |
| `gem_reels.py` | Renderer: 1080×1920 MP4, text inside TikTok's safe area, captions timed to narration. |
| `media.py` | Pexels real-people footage (`PEXELS_API_KEY`) and Piper open-source narration (`PIPER_MODEL`). Each degrades gracefully: no key → branded background; no voice → silent. |
| `run-worker-batch.sh` | Runs `video:worker:once` in cycles until the render queue is drained. |

## Setup

### Vercel (project `support371-gem-enterprise`)

| Variable | Value |
|---|---|
| `VIDEO_RENDER_DISPATCH_MODE` | `worker` |
| `COMFYUI_WORKFLOW_JSON` | `{"6":{"class_type":"GemReelsPrompt","inputs":{"text":""}},"3":{"class_type":"GemReelsSeed","inputs":{"seed":0}}}` |
| `COMFYUI_PROMPT_NODE_ID` | `6` |
| `COMFYUI_SEED_NODE_ID` | `3` |
| `VIDEO_RENDER_CALLBACK_SECRET` | new random secret (`openssl rand -hex 32`) |
| `VIDEO_RENDER_STORAGE_URL`, `VIDEO_RENDER_STORAGE_AUTH_ORIGIN`, `VIDEO_ASSET_ALLOWED_ORIGINS` | your Supabase project URL |
| `VIDEO_RENDER_STORAGE_KEY` | restricted storage credential for the render bucket |

Create a private Supabase Storage bucket named `gem-video-renders`.

### GitHub (Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `VIDEO_RENDER_CALLBACK_SECRET` | same value as Vercel |
| `VIDEO_RENDER_STORAGE_URL` | Supabase project URL |
| `VIDEO_RENDER_STORAGE_KEY` | same restricted storage credential |
| `PEXELS_API_KEY` | free key from <https://www.pexels.com/api/> |

Optional repository variables: `GEM_VIDEO_WORKER_API_URL` (defaults to `https://www.gemcybersecurityassist.com`), `VIDEO_RENDER_STORAGE_BUCKET` (defaults to `gem-video-renders`).

Until the three required secrets exist, the scheduled workflow exits early with a notice instead of failing.

## Local preview

Render a recipe without the worker:

```bash
python3 tools/content-studio/comfy_compat.py &   # then POST a workflow to http://127.0.0.1:8188/prompt
```

## Content rules carried into every render

- Real-people footage only from Pexels; the licence forbids showing identifiable people negatively or as endorsing GEM. `CREDITS.json` records every clip.
- Mock screens use fictional brands only.
- Narration is synthetic: the TikTok AI-generated content disclosure applies when posting.
- Music is added from TikTok's sound library at publish time.
