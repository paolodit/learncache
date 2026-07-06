# Personal CapRover Env Notes Template

Copy this file to `personal/learncache-caprover-env.md` for your own private deployment notes. The `personal/` folder is ignored by Git.

```dotenv
APP_PUBLIC_URL=https://learncache.example.com
DATA_DIR=/data
API_HOST=0.0.0.0
API_PORT=80

AUTH_ENABLED=true
AUTH_PROVIDER=password
APP_PASSWORD=replace-with-a-long-private-password
APP_SESSION_SECRET=replace-with-a-long-random-secret
EXTENSION_API_TOKEN=replace-with-a-different-long-random-token
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://*

AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
OPENAI_API_KEY=replace-with-openai-key
OPENAI_SUMMARY_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe

YOUTUBE_TRANSCRIPT_PROVIDER=auto
SUPADATA_API_KEY=
SUPADATA_TRANSCRIPT_MODE=native
SUPADATA_LANG=en

YTDLP_COOKIES_PATH=
```

CapRover persistent directory:

```text
Path in app: /data
Label: learncache-data
```

After deploy:

1. Open `/api/health`.
2. Sign in with `APP_PASSWORD`.
3. Open `/setup`.
4. Run `npm run setup:extension`.
5. Load `extension/build/chrome-mv3-prod` in `chrome://extensions`.
