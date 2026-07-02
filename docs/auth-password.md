# LearnCache Password Auth

Password auth is the recommended hosted mode for a personal LearnCache instance.

It gives you:

- One web app password.
- One long extension API token.
- HTTP-only browser session cookies.
- No OAuth dashboard, redirect URLs, extension allowlist, or user-management service.

## Local Mode

Local installs normally do not need auth:

```dotenv
AUTH_ENABLED=false
AUTH_PROVIDER=none
API_HOST=127.0.0.1
```

## Hosted Mode

For a hosted single-user install:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=password
APP_PASSWORD=generate-a-long-random-password
APP_SESSION_SECRET=generate-a-long-random-secret
EXTENSION_API_TOKEN=generate-a-different-long-random-token
CORS_ALLOWED_ORIGINS=https://learncache.example.com,chrome-extension://YOUR_EXTENSION_ID
```

Use different values for `APP_PASSWORD`, `APP_SESSION_SECRET`, and `EXTENSION_API_TOKEN`.

Generate secrets with a password manager, `openssl rand -base64 48`, or PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

## How It Works

- The web app shows a simple LearnCache password screen.
- A successful login sets a `HttpOnly`, `SameSite=Lax` session cookie.
- The Chrome extension sends `Authorization: Bearer EXTENSION_API_TOKEN`.
- API data, thumbnails, and exports are protected when `AUTH_ENABLED=true`.

## Extension Token

The extension token is embedded into your local extension build from `extension/local/config.json`. That file is ignored by Git.

The token is not a browser-user password. Treat it like an API key: rotate it if you share the built extension or suspect it leaked.

## Clerk

Clerk is no longer the recommended path for personal hosted LearnCache. The backend still has a compatibility provider for advanced users:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=clerk
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ALLOWED_EMAILS=you@example.com
```

The bundled frontend and extension are optimized for `AUTH_PROVIDER=password`.
