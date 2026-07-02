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

`local/config.json` is ignored by Git. Put your real hosted app URL, Clerk publishable key, and extension host permissions in that file:

```json
{
  "appUrl": "https://learncache.example.com",
  "clerkPublishableKey": "pk_...",
  "hostPermissions": [
    "http://127.0.0.1:3000/*",
    "http://localhost:3000/*",
    "https://www.youtube.com/*",
    "https://learncache.example.com/*"
  ]
}
```

`npm run build:local` temporarily applies your private host permissions for the build, then restores the tracked `package.json` so personal domains do not get staged.

Load the generated extension from `build/chrome-mv3-prod` in Chrome's extension developer mode.

For public/local-only builds that do not need private hosted settings, you can still use environment variables:

```powershell
$env:PLASMO_PUBLIC_APP_URL="http://127.0.0.1:3000"
$env:PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
npm run build
```

If you use a hosted app, make sure `hostPermissions` includes that app origin:

```json
"hostPermissions": [
  "http://127.0.0.1:3000/*",
  "http://localhost:3000/*",
  "https://www.youtube.com/*",
  "https://learncache.example.com/*"
]
```

The popup sends browser-captured YouTube transcripts to `/api/items/import-transcript` when possible. Otherwise it sends the current tab to `/api/items` with a Clerk session token. The context menu opens `/capture?url=...` as a safe fallback because that path relies on the normal web app session.

## Troubleshooting

If the popup says `Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY.`, edit `local/config.json`, rebuild with `npm run build:local`, then reload the unpacked extension. The value is embedded at build time, so setting it after the build will not fix an already-built extension.

If requests to the hosted app fail, confirm `local/config.json` includes your hosted app in `hostPermissions`, then add the Chrome extension origin to the hosted app's `CORS_ALLOWED_ORIGINS`.

If Clerk shows the sign-in UI but does not complete sign-in, copy the extension ID from `chrome://extensions` and add this origin to Clerk's allowed origins:

```text
chrome-extension://EXTENSION_ID
```
