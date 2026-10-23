# Content Studio

Renders TikTok / Reels videos and photo carousels from a JSON post list, for free:

| Piece | Source | Cost |
|---|---|---|
| Real-people footage | [Pexels](https://www.pexels.com/license/) video API | Free (API key) |
| Voiceover | [Piper](https://github.com/OHF-Voice/piper1-gpl) open-source voice | Free |
| Captions | Burned in, timed to the voiceover | Free |
| Rendering | GitHub Actions (public repo) | Free |

Nothing is published automatically. The output is a download you review, then post (TikTok in the app until the Content Posting API audit passes; other channels through `/app/social-media`).

## One-time setup

1. Create a free Pexels API key at <https://www.pexels.com/api/>.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name `PEXELS_API_KEY`, paste the key.

Without the key, scenes fall back to the branded animated background. Voice works without any key.

## Render a batch

1. GitHub → **Actions → Content Studio → Run workflow**.
2. Keep the defaults (or pick a voice, or a single post id), then **Run**.
3. When it finishes (about 1 minute per video), open the run and download the **content-N** artifact.

Each post produces:

- `<id>.mp4` for videos, or `<id>-1.png … <id>-N.png` for carousels
- `<id>.txt`: the caption and hashtags, ready to paste
- `CREDITS.json`: the Pexels clips used (licence allows commercial use without attribution; crediting is good practice)

## Writing posts

Add or edit a file in `posts/`. Each post:

```json
{
  "id": "w2-mon-1-example", "format": "video", "brand": "GEM Enterprise",
  "caption": "Caption pasted into TikTok.", "hashtags": "#cybersecurity #gementerprise",
  "scenes": [
    { "type": "hook", "dur": 2.5, "text": "Big opening line", "sub": "smaller teal line",
      "say": "What the voice says.", "footage": "pexels search words" },
    { "type": "point", "dur": 4, "chip": "1 / 3", "title": "Point title", "body": "Supporting line",
      "say": "Narration for this point.", "footage": "person using laptop office",
      "mock": { "type": "email | link | alert", "...": "see posts/week-1.json" } },
    { "type": "end", "dur": 3, "lines": ["Closing", "line."], "cta": "Follow for more.", "say": "Closing line." }
  ]
}
```

- `dur` is a minimum; a scene stretches to fit its narration.
- `footage` is optional per scene; scenes with a `mock` read better without footage.
- `format: "carousel"` renders one 1080×1920 image per scene (no voice or footage).

## Content rules

- Education only: no returns, guarantees or "get rich" claims. Mark money topics "Not financial advice".
- Mock emails and links use fictional brands (for example "NorthBank"). Never imitate a real company.
- Pexels licence: don't show identifiable people in a negative light or as endorsing GEM.
- The voice is synthetic: switch on TikTok's **AI-generated content** label when posting.
- Add music from TikTok's sound library in the app; uploaded tracks need their own licence.
