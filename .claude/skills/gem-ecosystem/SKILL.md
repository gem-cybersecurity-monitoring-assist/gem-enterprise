---
name: gem-ecosystem
description: Map of the owner's other GitHub repositories and how each relates to GEM Enterprise. Use when a request mentions another app, bot or site (crypto signals, BTCC trading, Telegram bot, GlobalGateway, Alliance identity, Taskade agent, older GEM sites), to decide whether to build it here, integrate with it, or work in its own repository.
---

# GEM ecosystem map

Surveyed 2026-11-07 from the 12 most recently active repositories.

## Canonical platform

| Repository | Role |
|---|---|
| `gem-cybersecurity-monitoring-assist/gem-enterprise` | **This repository.** The only canonical GEM platform: website, client and admin portals, TokMetric, social command center. Vercel project `support371-gem-enterprise`, domain `www.gemcybersecurityassist.com`. |
| `support371/gem-enterprise` | **Not the platform.** A README-only placeholder created on 2026-11-04 under the old name. Never clone, push or link to it. |

## Separate products with their own repositories

| Repository | What it is | How it relates to GEM |
|---|---|---|
| `gem-cybersecurity-monitoring-assist/crypto-signal-bot` (fork: `support371/crypto-signal-bot`) | Vite/React + Cloudflare Worker, D1, R2, KV. Paper, certification and testnet trading only | Separate product with strict live-trading locks. Build its features in its own repository. GEM may link to it or show its read-only status. |
| `gem-cybersecurity-monitoring-assist/btcc-copy-manager` | Next.js mobile control room that signs and submits **real** BTCC futures orders | Separate, real-money system. Never import its trading code or keys into GEM. |
| `gem-cybersecurity-monitoring-assist/GlobalGateway` | Vite + Express + Drizzle + Stripe app for logistics, property and legal services | Draft PR #433 integrates it into GEM as a gated business line. Integrate through that lane. |
| `support371/Mygemassistcontentbot` | Vercel-hosted opt-in Telegram growth bot, TikTok autopost workflow | Separate bot. GEM social publishing must not create a second Telegram or TikTok publisher (GEM uses its own Telegram lane and TokMetric). |
| `support371/telegram-growth-guide` | Lovable TanStack Start site with Telegram channel growth tips | Marketing site; link from GEM, don't merge code. |
| `support371/Gem-Alliance` | Vite web3 identity dashboard for `allianceforward.base.eth` | Standalone; GEM may link to it. |
| `support371/GEM-Assist_AI_Autonomous_Agent` | Replit Expo + Express app with the GEM Taskade integration | Separate agent app; integrate through APIs, not shared code. |
| `support371/GemAssistEnterprise` | Older Flask + Next.js GEM site | Legacy; reuse ideas, but build new features in this repository. |
| `support371/Homework` | Uploaded Lovable project archive only | Not code under active development. |

## Rules for cross-repository requests

1. If a request belongs to a separate product, build it in that product's repository; here, add only the link, status card or API integration.
2. Trading, wallet and real-money capability never moves into GEM. GEM shows read-only status at most.
3. Integrations between repositories use HTTP APIs with keys held in Vercel, never shared databases or copied secrets.
