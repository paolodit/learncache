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

## YouTube Says "Sign In To Confirm You're Not A Bot"

Hosted servers and VPS IPs can be challenged by YouTube even when the same URL works locally.

For desktop Chrome users, prefer the LearnCache extension. When you click the popup on an open YouTube video, the extension tries to capture available captions from the browser page and sends the transcript to LearnCache directly. That avoids asking the server to act like a YouTube browser.

For hosted paste/share capture, configure Supadata before falling back to cookie files:

```dotenv
YOUTUBE_TRANSCRIPT_PROVIDER=auto
SUPADATA_API_KEY=...
SUPADATA_TRANSCRIPT_MODE=native
```

Cookie files are a lower-level fallback for server-side `yt-dlp`, not the recommended user experience. If you have permission to process the video and still want hosted server extraction, export a Netscape-format cookies file from a browser profile you control, store it outside git, and point LearnCache at it:

```dotenv
YTDLP_COOKIES_PATH=/data/youtube-cookies.txt
```

In CapRover, `/data` should be a persistent directory. Copy the file into the running container's `/data` volume and then Save & Restart the app. Treat the cookies file like a password.

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

Use the Chrome extension, add `SUPADATA_API_KEY` for hosted YouTube transcript fallback, or switch to `AI_TRANSCRIBE_PROVIDER=openai` / `local-whisper` for audio fallback.

## Hosted Auth 401 Or 403

- `401`: you are not signed in, your session expired, or the extension bearer token does not match `EXTENSION_API_TOKEN`.
- `403`: your hosted auth provider is configured but not allowing the current request.

For password auth, check:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=password
APP_PASSWORD=...
APP_SESSION_SECRET=...
EXTENSION_API_TOKEN=...
```

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
