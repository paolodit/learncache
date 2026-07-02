# Deploy LearnCache With Docker

This is the provider-neutral hosting path. Use it for a VPS, Coolify, Dokku, Portainer, Unraid, Docker Compose, or any host that can run one persistent Docker container behind HTTPS.

CapRover is just one example of this model. The public repo keeps hosting docs generic so personal domains and provider choices stay private.

## Hosting Requirements

- One running app instance
- A persistent volume mounted at `/data`
- HTTPS in front of the container
- Server-side environment variables for AI and auth keys
- Enough CPU/disk for `yt-dlp`, `ffmpeg`, transcripts, and thumbnail caching

SQLite is intentionally the v1 database. It is portable and easy to back up, but it should not be written by multiple app instances at once.

## Build The Image

```bash
docker build -t learncache:latest .
```

The image includes:

- Node.js 24 runtime
- Production frontend and Fastify server
- Drizzle migrations
- `ffmpeg`
- Standalone `yt-dlp`

## Run With Docker

```bash
docker volume create learncache-data

docker run -d \
  --name learncache \
  --restart unless-stopped \
  -p 8080:80 \
  -v learncache-data:/data \
  -e APP_PUBLIC_URL=https://learncache.example.com \
  -e DATA_DIR=/data \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=80 \
  -e AUTH_ENABLED=true \
  -e AUTH_PROVIDER=password \
  -e APP_PASSWORD=generate-a-long-random-password \
  -e APP_SESSION_SECRET=generate-a-long-random-secret \
  -e EXTENSION_API_TOKEN=generate-a-different-long-random-token \
  -e AI_TEXT_PROVIDER=openai \
  -e AI_TRANSCRIBE_PROVIDER=openai \
  -e YOUTUBE_TRANSCRIPT_PROVIDER=auto \
  -e OPENAI_API_KEY=sk-... \
  -e SUPADATA_API_KEY= \
  -e YTDLP_COOKIES_PATH=/data/youtube-cookies.txt \
  learncache:latest
```

Put a reverse proxy in front of port `8080` and terminate HTTPS there.

## Run With Docker Compose

Copy [docker-compose.example.yml](../docker-compose.example.yml) to a private compose file and edit the environment values:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
```

Do not commit a filled-in `docker-compose.yml` if it contains real domains, emails, extension IDs, or keys.

The repo ignores `docker-compose.yml` and `docker-compose.*.yml` by default for that reason.

## Provider Notes

- **VPS / Docker Compose:** Use the example compose file with Caddy, Nginx Proxy Manager, Traefik, or your existing reverse proxy.
- **Coolify / Dokku / Portainer:** Deploy from the Dockerfile, mount `/data`, expose container port `80`, and set env vars in the provider UI.
- **Fly.io / Railway / Render:** Use one instance only and attach persistent storage if the provider supports it. If persistent disks are awkward or unavailable, do not use SQLite there for anything you care about.
- **CapRover:** See the [CapRover deployment example](deploy-caprover.md) for the provider-specific button-pushing version.

## Required Hosted Environment

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
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://YOUR_EXTENSION_ID
YTDLP_COOKIES_PATH=
```

Then choose AI providers:

```dotenv
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
YOUTUBE_TRANSCRIPT_PROVIDER=auto
OPENAI_API_KEY=sk-...
SUPADATA_API_KEY=
SUPADATA_TRANSCRIPT_MODE=native
SUPADATA_LANG=en
```

For lower-cost setups, use OpenRouter or Gemini for summaries, Supadata for hosted YouTube transcript fallback, and `captions-only` or `local-whisper` for transcription. See [AI providers](ai-providers.md).

## YouTube Bot Checks

Cloud/VPS IPs are more likely to hit YouTube's "Sign in to confirm you're not a bot" challenge. Prefer the desktop extension for browser capture, or configure Supadata for hosted paste/share capture:

```dotenv
YOUTUBE_TRANSCRIPT_PROVIDER=auto
SUPADATA_API_KEY=...
SUPADATA_TRANSCRIPT_MODE=native
```

LearnCache also supports a persistent yt-dlp cookies file as a lower-level fallback:

```dotenv
YTDLP_COOKIES_PATH=/data/youtube-cookies.txt
```

Export cookies in Netscape format from a browser account you control, copy the file into the mounted `/data` volume, and restart the app. Cookies can grant access to your account, so use a low-risk account, keep the file private, and rotate/delete it if it leaks.

## Backups

Back up the whole `/data` volume:

- `/data/app.db`
- `/data/app.db-wal`
- `/data/app.db-shm`
- `/data/thumbnails`

Take backups before redeploying, changing AI providers, migrating hosts, or upgrading across large schema changes.

## Smoke Test

1. Visit `https://learncache.example.com/api/health`.
2. Sign in through the web app with `APP_PASSWORD`.
3. Capture one captioned YouTube video.
4. Confirm the item completes and shows a thumbnail/source card.
5. Export Markdown, JSON, and ZIP.
6. Restart or redeploy the container and confirm the item is still there.
