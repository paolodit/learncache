# LearnCache

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/node-24%2B-3c873a.svg)](https://nodejs.org/)

LearnCache is a local-first web app for turning YouTube videos, podcast episodes, and direct audio links into a private searchable learning archive.

Paste or share a link, let the app pull captions or transcribe audio, then get structured notes with a TL;DR, key ideas, timestamped outline, notable claims, tags, follow-up questions, transcript search, source cards, cached thumbnails, and portable exports.

It is built for two modes:

- **Private local use:** SQLite in `./data`, no auth, no hosted account required.
- **Optional self-hosting:** Docker on a single-instance host, persistent `/data`, Clerk login, email allowlist, HTTPS, and browser/mobile capture.

## Why LearnCache?

Tools like Glasp are useful, but the free tier can be tight if you want private highlights, richer summaries, Notion/export flows, or audio transcription. LearnCache keeps the durable archive under your control. You can start with YouTube captions only, add a cheap/free text model, or bring your own paid transcription provider when you need podcasts and no-caption videos.

## Features

- Capture YouTube, podcast page, or direct audio URLs.
- Deduplicate and normalize source links.
- Fetch YouTube metadata and captions with `yt-dlp`.
- Fall back to OpenAI or local Whisper transcription for audio when configured.
- Generate structured learning notes through OpenAI, OpenRouter, or Gemini.
- Store everything in SQLite: items, transcripts, summaries, thumbnails, jobs, logs, and FTS search index.
- Show a source card above every note with thumbnail, title, creator, duration, source links, status, and model/provider metadata.
- Export Markdown, JSON, or ZIP with `notes.md`, `item.json`, and `assets/thumbnail.*`.
- Run with no auth locally, or protect hosted installs with Clerk and an email allowlist.
- Capture from the web UI, `/capture`, PWA share target, or the optional desktop Chrome extension.

## What It Does Not Do Yet

- No Notion sync in v1. Exports are Markdown, JSON, and ZIP.
- No browser extension on Chrome mobile. Mobile uses the PWA/share/paste flow.
- No multi-user SaaS tenancy. Hosted SQLite is intended for one app instance with a persistent volume.
- No DRM, paywall, private feed, or authenticated media bypassing.

## Quick Start

```powershell
npm install
npm run tools:install-ytdlp
Copy-Item .env.example .env
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

For a no-spend first run, set this in `.env` and paste a YouTube video that already has captions:

```dotenv
AI_TRANSCRIBE_PROVIDER=captions-only
```

For full OpenAI summaries and audio transcription:

```dotenv
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Configuration Paths

### Local And Private

```dotenv
APP_PUBLIC_URL=http://127.0.0.1:3000
DATA_DIR=./data
API_HOST=127.0.0.1
API_PORT=4311
AUTH_ENABLED=false
```

This is the default GitHub user experience: single-user, private, and backed by files you can back up.

### Cheap Or Free-ish AI

```dotenv
AI_TEXT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_TEXT_MODEL=openrouter/free
AI_TRANSCRIBE_PROVIDER=captions-only
```

You can also use Gemini for summaries, or local Whisper for transcription. Free tiers and free routers are best-effort and can change, so the docs call out the tradeoffs.

### Hosted With Docker

```dotenv
APP_PUBLIC_URL=https://learncache.example.com
DATA_DIR=/data
API_HOST=0.0.0.0
API_PORT=80
AUTH_ENABLED=true
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ALLOWED_EMAILS=you@example.com
```

SQLite works here as long as the app runs as a single instance and `/data` is persistent. See [docs/deploy-docker.md](docs/deploy-docker.md) for the provider-neutral deployment path.

## Screenshots

This repo intentionally does not link to a public demo instance. LearnCache is for private archives, so public previews should be sanitized screenshots instead of live personal domains.

Add screenshots under [docs/screenshots](docs/screenshots) when you are ready, using local/sample data only.

## Requirements

- Node.js 24+
- `yt-dlp` for YouTube metadata and captions
- `ffmpeg` for podcast/audio transcription and YouTube audio fallback
- One text-summary provider key for generated notes: OpenAI, OpenRouter, or Gemini
- Optional Clerk keys for hosted auth

## Scripts

- `npm run dev` starts Vite with the local API and worker embedded.
- `npm run dev:api` starts the standalone API server on `API_PORT`.
- `npm run build` type-checks and builds frontend plus production server JS.
- `npm start` runs the compiled production server.
- `npm test` runs unit tests.
- `npm run tools:install-ytdlp` installs `yt-dlp.exe` locally on Windows.

## Documentation

- [Local quickstart](docs/local-quickstart.md)
- [AI providers and cheap/free options](docs/ai-providers.md)
- [Hosted Docker deployment](docs/deploy-docker.md)
- [CapRover deployment example](docs/deploy-caprover.md)
- [Clerk auth](docs/auth-clerk.md)
- [Desktop Chrome extension](docs/chrome-extension.md)
- [Mobile capture and PWA sharing](docs/mobile-capture.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Troubleshooting](docs/troubleshooting.md)

## Repo Layout

```text
src/client/       React app
src/server/       Fastify API, worker, media processing, exports
src/shared/       Shared TypeScript types
drizzle/          SQLite migrations
docs/             GitHub documentation
extension/        Optional desktop Chrome extension
public/           PWA manifest, icon, service worker
scripts/          Local helper scripts
```

## Responsible Use

Only process media you have rights or permission to process. LearnCache does not bypass DRM, paywalls, private feeds, platform authentication, or content restrictions.

## License

MIT. See [LICENSE](LICENSE).
