# LearnCache Clerk Auth

Auth is optional. Local installs should usually leave it off:

```dotenv
AUTH_ENABLED=false
```

Hosted installs should turn it on and use an allowlist:

```dotenv
AUTH_ENABLED=true
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ALLOWED_EMAILS=you@example.com,friend@example.com
APP_PUBLIC_URL=https://learncache.example.com
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://YOUR_EXTENSION_ID
```

## Behavior

- Static frontend files can load without auth.
- API data, thumbnails, and exports require auth when `AUTH_ENABLED=true`.
- Signed-out API requests return `401`.
- Signed-in users not listed in `ALLOWED_EMAILS` return `403`.
- If `AUTH_ENABLED=true` and `ALLOWED_EMAILS` is empty, access is denied.

## Clerk Setup

1. Create a Clerk application.
2. Copy the publishable key into `CLERK_PUBLISHABLE_KEY`.
3. Copy the secret key into `CLERK_SECRET_KEY`.
4. Add your hosted app URL in Clerk's allowed origins/settings as needed.
5. Add your email to `ALLOWED_EMAILS`.

The frontend receives only the publishable key from `/api/config`. The secret key stays server-side.

## Extension Auth

The desktop extension uses Clerk's Chrome extension SDK in its popup and sends a session token as `Authorization: Bearer ...`.

The popup uses:

- `POST /api/items/import-transcript` when it can capture a YouTube transcript from the open browser tab.
- `POST /api/items` when it falls back to URL-only capture.

Add the final extension origin to `CORS_ALLOWED_ORIGINS`:

```dotenv
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://abcdefghijklmnopabcdefghijklmnop
```

The extension context-menu fallback opens `/capture?url=...`, which relies on the normal web app session.
