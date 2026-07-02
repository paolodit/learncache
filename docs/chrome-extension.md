# LearnCache Desktop Chrome Extension

The extension lives in `extension/` as a separate Plasmo project.

It is for desktop Chrome. Mobile capture uses the PWA/share/paste flow.

## Setup

```powershell
cd extension
npm install

# Option A: set env vars for this PowerShell session
$env:PLASMO_PUBLIC_APP_URL="https://learncache.example.com"
$env:PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
npm run build
```

Or copy `extension/.env.example` to an ignored local env file and edit it:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm run build
```

Load `extension/build/chrome-mv3-prod` in Chrome extension developer mode.

For hosted builds, prefer an ignored local config so your private domain and Clerk key never touch tracked files:

```powershell
New-Item -ItemType Directory -Force local
Copy-Item local.example.json local/config.json
notepad local/config.json
npm run build:local
```

`extension/local/config.json` should contain your app URL, Clerk publishable key, and host permissions:

```json
{
  "appUrl": "https://learncache.example.com",
  "clerkPublishableKey": "pk_...",
  "clerkSyncHost": "https://your-clerk-frontend-api.clerk.accounts.dev",
  "hostPermissions": [
    "http://127.0.0.1:3000/*",
    "http://localhost:3000/*",
    "https://www.youtube.com/*",
    "https://learncache.example.com/*",
    "https://your-clerk-frontend-api.clerk.accounts.dev/*"
  ]
}
```

`npm run build:local` temporarily applies those host permissions for the build, then restores the tracked `extension/package.json`. Keep personal domains out of public commits.

`clerkSyncHost` is required for hosted Clerk builds. It is the Clerk Frontend API host from Clerk's Domains page. For development instances it usually looks like `https://something.clerk.accounts.dev`. The extension uses it to share the web app's Clerk session instead of trying to complete Google OAuth inside the popup.

## Permissions

The extension asks for:

- `activeTab` to read the current tab URL from the popup.
- `contextMenus` to add "Save to LearnCache".
- `cookies` so Clerk can sync the browser extension session with the web app session.
- `scripting` to read caption metadata from the active YouTube tab after you click the popup button.
- `storage` for Clerk extension session support.
- Host permission for your app URL.
- Host permission for your Clerk sync host.
- Host permission for `https://www.youtube.com/*` so the popup can capture captions from the tab you already have open.

Avoid broad host permissions like `<all_urls>` unless you add features that genuinely need them.

## Capture Paths

- Popup button on YouTube: first tries browser transcript capture. If YouTube exposes caption tracks to the open page, the extension sends title, thumbnail, timestamped transcript, and source URL to `POST /api/items/import-transcript`. LearnCache then summarizes the saved transcript without server-side `yt-dlp`.
- Popup button elsewhere, or YouTube with no visible captions: falls back to `POST /api/items` with the current tab URL and Clerk session token.
- Context menu: opens `https://learncache.example.com/capture?url=...` as a safe fallback.

This is the preferred hosted workflow because the browser is already signed into YouTube. The server-side `yt-dlp` path remains useful for local installs, caption checks, podcasts, direct audio, and fallback processing, but users should not need to copy YouTube cookies for normal desktop capture.

## Production Checklist

1. Build the extension.
2. Load it in Chrome and copy the extension ID from `chrome://extensions`.
3. Add `chrome-extension://EXTENSION_ID` to Clerk's allowed origins.
4. Add `chrome-extension://EXTENSION_ID` to LearnCache's `CORS_ALLOWED_ORIGINS`.
5. Rebuild/reload if Clerk needs a stable CRX ID.
6. Test signed-out, signed-in allowlisted, and signed-in non-allowlisted behavior.

## Clerk Extension Origin

The extension origin is not your hosted website. It is:

```text
chrome-extension://EXTENSION_ID
```

Find `EXTENSION_ID` in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Open the LearnCache extension card.
4. Copy the `ID` value.

Add that full origin in two places:

- Clerk instance allowed origins.
- LearnCache hosted env var:

```dotenv
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://EXTENSION_ID
```

If Clerk shows a sign-in UI but sign-in fails, the most likely cause is that `chrome-extension://EXTENSION_ID` is missing from Clerk's allowed origins.

Do not rely on Google OAuth inside the popup. Clerk does not support OAuth/SAML redirects directly in Chrome extensions. Sign in on the normal LearnCache web app tab, then reopen the extension popup. The extension syncs that web session through `clerkSyncHost`.

## Troubleshooting

If the popup says:

```text
Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY.
```

the extension was built without the Clerk publishable key. Set `PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY`, rebuild with `npm run build`, then reload the unpacked extension in Chrome. Plasmo embeds `PLASMO_PUBLIC_*` values at build time, so changing env vars after the build is not enough.

If requests to the hosted app fail, check both sides:

- `extension/local/config.json` includes your hosted app in `hostPermissions` before running `npm run build:local`.
- `extension/local/config.json` includes `clerkSyncHost` and a matching host permission.
- The hosted app has `CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://YOUR_EXTENSION_ID`.
