# CapRover Deployment Example

This is a provider-specific example for people who already use CapRover. For the generic hosting path, start with [Deploy LearnCache With Docker](deploy-docker.md).

This repo includes a `Dockerfile` and `captain-definition` that CapRover can deploy directly.

## App Setup

1. Create a new CapRover app, for example `learncache`.
2. Point your chosen domain, for example `learncache.example.com`, at the CapRover server.
3. Add the custom domain in CapRover.
4. Enable HTTPS with Let's Encrypt.
5. Enable persistence and add persistent directory `/data`.
6. Keep the app at one instance.

SQLite is safe for this v1 only as a single-instance app. Do not scale it horizontally unless you migrate the storage layer to Postgres or another shared database.

Keep personal domains, private emails, and production secrets in local notes or private deployment settings, not in public commits.

## Environment

Recommended hosted env:

```dotenv
APP_PUBLIC_URL=https://learncache.example.com
DATA_DIR=/data
API_HOST=0.0.0.0
API_PORT=80
AUTH_ENABLED=true
AUTH_PROVIDER=password
APP_PASSWORD=generate-a-long-random-password
APP_SESSION_SECRET=generate-a-long-random-secret
EXTENSION_API_TOKEN=generate-a-different-long-random-token
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://*
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
YOUTUBE_TRANSCRIPT_PROVIDER=auto
OPENAI_API_KEY=sk-...
OPENAI_SUMMARY_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
SUPADATA_API_KEY=
SUPADATA_TRANSCRIPT_MODE=native
SUPADATA_LANG=en
YTDLP_COOKIES_PATH=
```

For cheaper summaries, switch `AI_TEXT_PROVIDER` to `openrouter` or `gemini` and set the matching key.

For a hosted YouTube transcript fallback, create a Supadata key and set `SUPADATA_API_KEY`. In `auto` mode LearnCache tries `yt-dlp` captions first, then Supadata, then your configured audio transcription fallback. Supadata's free quota and pricing can change, so check [Supadata pricing](https://supadata.ai/pricing) before depending on it.

If YouTube challenges the VPS with "Sign in to confirm you're not a bot", export a Netscape-format YouTube cookies file from a browser profile you control, copy it into the persistent `/data` directory, and set:

```dotenv
YTDLP_COOKIES_PATH=/data/youtube-cookies.txt
```

Treat this file like a password. Do not commit it, paste it into issues, or include it in screenshots.

## Deploy

From your machine:

```powershell
npm install -g caprover
caprover login
caprover deploy
```

Or upload a tarball through the CapRover dashboard.

## What The Container Includes

- Node.js 24 runtime
- Production frontend in `dist`
- Production server JS in `dist-server`
- Drizzle SQL migration files
- `ffmpeg`
- Standalone `yt-dlp`

## Backups

Back up `/data`, especially:

- `/data/app.db`
- `/data/app.db-wal`
- `/data/app.db-shm`
- `/data/thumbnails`

Take backups before redeploys, host migrations, or model/provider experiments.

## Smoke Test

1. Visit `https://learncache.example.com/api/health`.
2. Sign in through the web app with `APP_PASSWORD`.
3. Paste a captioned YouTube video.
4. Confirm the item completes and survives a redeploy.
5. Download ZIP export and confirm it contains `notes.md`, `item.json`, and thumbnail asset.
