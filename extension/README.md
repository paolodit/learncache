# LearnCache Chrome Extension

This is the optional desktop Chrome capture extension for LearnCache. Mobile Chrome should use the PWA share/paste flow in the main app.

## Setup

```bash
npm install
set PLASMO_PUBLIC_APP_URL=https://learncache.example.com
set PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
npm run build
```

Load the generated extension from `build/chrome-mv3-prod` in Chrome's extension developer mode.

For hosted builds, also update `package.json` host permissions to your app domain before building. Do not commit personal domains to the public repo.

The popup sends the current tab to `/api/items` with a Clerk session token. The context menu opens `/capture?url=...` as a safe fallback because that path relies on the normal web app session.
