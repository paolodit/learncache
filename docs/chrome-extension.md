# LearnCache Desktop Chrome Extension

The extension lives in `extension/` as a separate Plasmo project.

It is for desktop Chrome. Mobile capture uses the PWA/share/paste flow.

## Setup

```powershell
cd extension
npm install
$env:PLASMO_PUBLIC_APP_URL="https://learncache.example.com"
$env:PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
npm run build
```

Load `extension/build/chrome-mv3-prod` in Chrome extension developer mode.

For hosted builds, also update `extension/package.json` host permissions to your app domain before building. Keep personal domains out of public commits.

## Permissions

The extension asks for:

- `activeTab` to read the current tab URL from the popup.
- `contextMenus` to add "Save to LearnCache".
- `scripting` to read caption metadata from the active YouTube tab after you click the popup button.
- `storage` for Clerk extension session support.
- Host permission for your app URL.
- Host permission for `https://www.youtube.com/*` so the popup can capture captions from the tab you already have open.

Avoid broad host permissions like `<all_urls>` unless you add features that genuinely need them.

## Capture Paths

- Popup button on YouTube: first tries browser transcript capture. If YouTube exposes caption tracks to the open page, the extension sends title, thumbnail, timestamped transcript, and source URL to `POST /api/items/import-transcript`. LearnCache then summarizes the saved transcript without server-side `yt-dlp`.
- Popup button elsewhere, or YouTube with no visible captions: falls back to `POST /api/items` with the current tab URL and Clerk session token.
- Context menu: opens `https://learncache.example.com/capture?url=...` as a safe fallback.

This is the preferred hosted workflow because the browser is already signed into YouTube. The server-side `yt-dlp` path remains useful for local installs, caption checks, podcasts, direct audio, and fallback processing, but users should not need to copy YouTube cookies for normal desktop capture.

## Production Checklist

1. Build the extension.
2. Load it in Chrome and copy the extension ID.
3. Add `chrome-extension://EXTENSION_ID` to `CORS_ALLOWED_ORIGINS`.
4. Rebuild/reload if Clerk needs a stable CRX ID.
5. Test signed-out, signed-in allowlisted, and signed-in non-allowlisted behavior.
