# LearnCache Troubleshooting

## Vite Proxy Or API Connection Errors

Run the normal dev server:

```powershell
npm run dev
```

The Vite dev server embeds the local API and worker. If you run frontend and API separately, make sure `API_PORT` matches the client proxy/debug setup.

## `yt-dlp` Is Missing

On Windows:

```powershell
npm run tools:install-ytdlp
```

Or install `yt-dlp` globally and make sure it is on `PATH`.

## `ffmpeg` Is Missing

Install `ffmpeg` globally or place `ffmpeg.exe` in `tools/bin`.

You need `ffmpeg` for:

- YouTube audio fallback when captions are missing
- Podcast/direct audio transcription
- Local Whisper normalization

Captioned YouTube items can work without `ffmpeg` if `AI_TRANSCRIBE_PROVIDER=captions-only`.

## Missing API Key

Check your provider mode:

```dotenv
AI_TEXT_PROVIDER=openai
OPENAI_API_KEY=...
```

or:

```dotenv
AI_TEXT_PROVIDER=openrouter
OPENROUTER_API_KEY=...
```

or:

```dotenv
AI_TEXT_PROVIDER=gemini
GEMINI_API_KEY=...
```

## Captions-Only Failure

This is expected if a YouTube video has no captions:

```text
No YouTube captions were found and AI_TRANSCRIBE_PROVIDER=captions-only is enabled.
```

Switch to `AI_TRANSCRIBE_PROVIDER=openai` or `local-whisper` for audio fallback.

## Clerk 401 Or 403

- `401`: you are not signed in.
- `403`: you are signed in but your email is not in `ALLOWED_EMAILS`, or `ALLOWED_EMAILS` is empty.

For extensions, also check:

```dotenv
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://YOUR_EXTENSION_ID
```

## Thumbnail Missing

The app stores the remote thumbnail URL and attempts to cache a local copy. If caching fails, the UI can still show the remote thumbnail URL. ZIP exports include the local thumbnail only when caching succeeded.

## Hosted Data Disappeared

Make sure the app is configured with a persistent volume and `/data` is actually mounted there. Hosted SQLite data should live under:

```dotenv
DATA_DIR=/data
```

On platforms such as CapRover, Coolify, Portainer, or Docker Compose, this usually means checking the volume or persistent-directory settings for the app/container.
