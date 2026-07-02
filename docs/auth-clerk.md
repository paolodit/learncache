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

Clerk also needs to trust the extension origin itself. The origin is:

```text
chrome-extension://EXTENSION_ID
```

Find `EXTENSION_ID` in `chrome://extensions` after loading `extension/build/chrome-mv3-prod`. Add the full origin to Clerk's allowed origins. Clerk's Chrome extension SDK requires this in both development and production.

If the dashboard does not show an obvious field for allowed origins, use Clerk's instance API with your secret key and include the full current allowed-origin list:

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Content-type: application/json" \
  -H "Authorization: Bearer sk_..." \
  -d '{"allowed_origins":["https://learncache.example.com","chrome-extension://EXTENSION_ID"]}'
```

Treat the secret key like a password. Do not commit it or paste it into public issues.

For Google sign-in, sign in through the normal LearnCache web app, not inside the popup. Clerk's Chrome extension package does not support OAuth/SAML redirects directly in extensions. The extension should be built with a Clerk sync host so it can share the web app session:

```json
{
  "clerkSyncHost": "https://your-clerk-frontend-api.clerk.accounts.dev"
}
```

Find this host in Clerk's Domains page. For development instances it is usually the verified `*.clerk.accounts.dev` primary domain. Include that host in the extension `hostPermissions` before running `npm run build:local`.

The popup uses:

- `POST /api/items/import-transcript` when it can capture a YouTube transcript from the open browser tab.
- `POST /api/items` when it falls back to URL-only capture.

Add the final extension origin to `CORS_ALLOWED_ORIGINS`:

```dotenv
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://abcdefghijklmnopabcdefghijklmnop
```

The extension context-menu fallback opens `/capture?url=...`, which relies on the normal web app session.
