# LearnCache Local Quickstart

This is the default path: a private app on your own machine, backed by SQLite in `./data`, with no login.

## Install On Windows

```powershell
npm install
npm run tools:install-ytdlp
Copy-Item .env.example .env
```

Install `ffmpeg` if you want podcast/audio transcription or YouTube audio fallback. Captioned YouTube videos can work without `ffmpeg` when `AI_TRANSCRIBE_PROVIDER=captions-only`.

## Install On macOS

macOS is not a separate app path. The only difference is how you install the command-line tools:

```bash
brew install node yt-dlp ffmpeg
npm install
cp .env.example .env
```

If your terminal cannot find `node`, `yt-dlp`, or `ffmpeg` after installing, open a new terminal window. On Apple Silicon Macs, Homebrew usually lives under `/opt/homebrew/bin`.

## Install On Linux

Use your package manager for Node.js 24+, `yt-dlp`, and `ffmpeg`, then:

```bash
npm install
cp .env.example .env
```

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

For a free-ish first run with captioned YouTube:

```dotenv
AI_TEXT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_TEXT_MODEL=openrouter/free
AI_TRANSCRIBE_PROVIDER=captions-only
```

See [AI providers](ai-providers.md) for links to OpenRouter free routing, Gemini keys/pricing, and local Whisper notes.

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
