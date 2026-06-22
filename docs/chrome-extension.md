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
- `storage` for Clerk extension session support.
- Host permission for your app URL.

Avoid broad host permissions like `<all_urls>` unless you add features that genuinely need them.

## Capture Paths

- Popup button: sends `POST /api/items` with the current tab URL and Clerk session token.
- Context menu: opens `https://learncache.example.com/capture?url=...` as a safe fallback.

## Production Checklist

1. Build the extension.
2. Load it in Chrome and copy the extension ID.
3. Add `chrome-extension://EXTENSION_ID` to `CORS_ALLOWED_ORIGINS`.
4. Rebuild/reload if Clerk needs a stable CRX ID.
5. Test signed-out, signed-in allowlisted, and signed-in non-allowlisted behavior.
