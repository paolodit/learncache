# LearnCache Chrome Extension

This is the optional desktop Chrome capture extension for LearnCache. Mobile Chrome should use the PWA share/paste flow in the main app.

On YouTube watch pages, the popup first tries to capture available caption tracks directly from the browser tab you already have open. If that succeeds, LearnCache receives the transcript and queues summary generation without asking the hosted server to run `yt-dlp` against YouTube. If captions are not exposed, the extension falls back to saving the URL.

## Setup

PowerShell:

```powershell
npm install
$env:PLASMO_PUBLIC_APP_URL="https://learncache.example.com"
$env:PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
npm run build
```

Or copy `.env.example` to `.env.local`, edit it, and build:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm run build
```

Load the generated extension from `build/chrome-mv3-prod` in Chrome's extension developer mode.

For hosted builds, also update `package.json` host permissions to your app domain before building:

```json
"host_permissions": [
  "http://127.0.0.1:3000/*",
  "http://localhost:3000/*",
  "https://www.youtube.com/*",
  "https://learncache.example.com/*"
]
```

Use your real hosted domain locally, rebuild, and load the rebuilt folder. Do not commit personal domains to the public repo.

The popup sends browser-captured YouTube transcripts to `/api/items/import-transcript` when possible. Otherwise it sends the current tab to `/api/items` with a Clerk session token. The context menu opens `/capture?url=...` as a safe fallback because that path relies on the normal web app session.

## Troubleshooting

If the popup says `Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY.`, rebuild the extension after setting `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY`. The value is embedded at build time, so setting it after the build will not fix an already-built extension.
