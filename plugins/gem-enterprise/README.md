# GEM Enterprise plugin for Claude Code

Gives Claude the operating rules for the GEM Enterprise platform (`www.gemcybersecurityassist.com`): the canonical architecture, the pull-request change flow, the Base44 boundary, public-claims and marketing rules, social publishing gates, and sales and email consent rules.

## Contents

| Path | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest |
| `.claude-plugin/icon.png` | Directory listing icon (1024 × 1024 PNG) |
| `skills/gem-governance/SKILL.md` | GEM governance skill |

The plugin contains documentation only. It runs no scripts, reads no credentials, and downloads nothing.

## Why it lives in a subfolder

The plugin is kept separate from the website source so the plugin directory validates only plugin files. Pointing the directory at the repository root would scan the whole application, including `.env.example` placeholders and site assets.

## Submitting to the plugin directory

| Field | Value |
|---|---|
| Repository | `https://github.com/support371/gem-enterprise` |
| Plugin path | `plugins/gem-enterprise` |
| Branch or tag | `main` (or leave empty) |

## Local check

```bash
claude plugin validate plugins/gem-enterprise
```
