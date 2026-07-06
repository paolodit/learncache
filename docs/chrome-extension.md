# LearnCache Desktop Chrome Extension

The extension lives in `extension/` as a separate Plasmo project.

It is for desktop Chrome. Mobile capture uses the PWA/share/paste flow.

## Why Use It

The extension is the best YouTube capture path because it runs in the browser tab where the video is already open. If YouTube exposes captions to that page, the extension sends the transcript directly to LearnCache and avoids server-side YouTube bot checks.

## Setup

Fast path from the repo root:

```powershell
npm run setup:extension
```

The wizard asks for your LearnCache URL and extension API token, writes ignored local config, and builds the unpacked extension.

Manual setup:

```powershell
cd extension
npm install
New-Item -ItemType Directory -Force local
Copy-Item local.example.json local/config.json
notepad local/config.json
```

`extension/local/config.json` is ignored by Git. Fill it with your hosted URL and the same token you set as `EXTENSION_API_TOKEN` on the server:

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

Build:

```powershell
npm run build:local
```

Load `extension/build/chrome-mv3-prod` in Chrome extension developer mode.

## Hosted Checklist

1. Set `EXTENSION_API_TOKEN` on the LearnCache server.
2. Put the exact same value in `extension/local/config.json`.
3. Include your app domain in `hostPermissions`.
4. Build with `npm run build:local`.
5. Load the extension from `extension/build/chrome-mv3-prod`.
6. Add `chrome-extension://*` to hosted `CORS_ALLOWED_ORIGINS`.
7. Restart the hosted app after env changes.
8. Visit `/setup` in the hosted app and confirm the extension token and Chrome extension CORS checks pass.

No Clerk setup is required.

You do not need to copy the extension ID for normal personal use. The extension API token is the actual gate. If you publish a fixed extension and want stricter CORS, replace `chrome-extension://*` with the exact `chrome-extension://EXTENSION_ID` origin.

## Permissions

The extension asks for:

- `activeTab` to read the current tab URL from the popup.
- `contextMenus` to add "Save to LearnCache".
- `scripting` to read caption metadata from the active YouTube tab after you click the popup button.
- `storage` for extension state.
- Host permission for your app URL.
- Host permission for `https://www.youtube.com/*` so the popup can capture captions from the tab you already have open.

Avoid broad host permissions like `<all_urls>` unless you add features that genuinely need them.

## Capture Paths

- Popup button on YouTube: first tries browser transcript capture. If YouTube exposes caption tracks to the open page, the extension sends title, thumbnail, timestamped transcript, and source URL to `POST /api/items/import-transcript`.
- Popup button elsewhere, or YouTube with no visible captions: falls back to `POST /api/items` with the current tab URL.
- Context menu: opens `https://learncache.example.com/capture?url=...` as a safe fallback.

## Troubleshooting

If the popup says:

```text
Missing PLASMO_PUBLIC_EXTENSION_API_TOKEN.
```

edit `extension/local/config.json`, add `extensionApiToken`, run `npm run build:local`, then reload the unpacked extension.

If requests to the hosted app fail:

- Confirm the token in `extension/local/config.json` exactly matches server `EXTENSION_API_TOKEN`.
- Confirm `hostPermissions` includes your hosted app.
- Confirm hosted `CORS_ALLOWED_ORIGINS` includes `chrome-extension://*` or the exact extension origin.
- Restart the hosted app after changing env vars.
