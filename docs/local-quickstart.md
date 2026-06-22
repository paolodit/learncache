# LearnCache Local Quickstart

This is the default path: a private app on your own machine, backed by SQLite in `./data`, with no login.

## Install

```powershell
npm install
npm run tools:install-ytdlp
Copy-Item .env.example .env
```

Install `ffmpeg` if you want podcast/audio transcription or YouTube audio fallback. Captioned YouTube videos can work without `ffmpeg` when `AI_TRANSCRIBE_PROVIDER=captions-only`.

## Configure

Minimal local `.env`:

```dotenv
APP_PUBLIC_URL=http://127.0.0.1:3000
DATA_DIR=./data
API_HOST=127.0.0.1
API_PORT=4311
AUTH_ENABLED=false
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=captions-only
OPENAI_API_KEY=
```

For full OpenAI transcription and summaries:

```dotenv
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_SUMMARY_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

## Run

```powershell
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Data

- SQLite database: `./data/app.db`
- SQLite WAL files: `./data/app.db-wal` and `./data/app.db-shm`
- Cached thumbnails: `./data/thumbnails`
- Temporary audio chunks: OS temp directory, deleted after processing

Back up the whole `data` directory if you care about the archive.

## First Test

1. Paste a captioned YouTube URL.
2. Wait for the item to complete.
3. Confirm the detail page shows a source card with thumbnail, source link, and model.
4. Export Markdown, JSON, and ZIP.
