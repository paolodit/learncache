# LearnCache Chrome Extension

This is the optional desktop Chrome capture extension for LearnCache. Mobile Chrome should use the PWA share/paste flow in the main app.

On YouTube watch pages, the popup first tries to capture available caption tracks directly from the browser tab you already have open. If that succeeds, LearnCache receives the transcript and queues summary generation without asking the hosted server to run `yt-dlp` against YouTube. If captions are not exposed, the extension falls back to saving the URL.

## Setup

PowerShell:

```powershell
npm install
New-Item -ItemType Directory -Force local
Copy-Item local.example.json local/config.json
notepad local/config.json
npm run build:local
```

`local/config.json` is ignored by Git. Put your real hosted app URL, extension API token, and extension host permissions in that file:

```json
{
  "appUrl": "https://learncache.example.com",
  "extensionApiToken": "generate-a-long-random-token",
  "hostPermissions": [
    "http://127.0.0.1:3000/*",
    "http://localhost:3000/*",
    "https://www.youtube.com/*",
    "https://learncache.example.com/*"
  ]
}
```

`extensionApiToken` must match the hosted server's `EXTENSION_API_TOKEN`.

Load the generated extension from `build/chrome-mv3-prod` in Chrome's extension developer mode.

## Hosted App Setup

Set this on the LearnCache server:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=password
EXTENSION_API_TOKEN=generate-a-long-random-token
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://*
```

You do not need to copy the extension ID for normal personal use. Rebuilt unpacked extensions can get a different ID, so LearnCache supports `chrome-extension://*` when extension auth uses `EXTENSION_API_TOKEN`. If you publish a fixed extension and want stricter CORS, replace the wildcard with the exact `chrome-extension://EXTENSION_ID` origin.

## Troubleshooting

If the popup says `Missing PLASMO_PUBLIC_EXTENSION_API_TOKEN.`, edit `local/config.json`, rebuild with `npm run build:local`, then reload the unpacked extension. The value is embedded at build time.

If capture requests fail, confirm:

- the extension token matches server `EXTENSION_API_TOKEN`;
- `hostPermissions` includes your app URL;
- `CORS_ALLOWED_ORIGINS` includes `chrome-extension://*` or the exact extension origin.
