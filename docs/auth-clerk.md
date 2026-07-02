# Clerk Auth Compatibility

LearnCache's recommended hosted auth mode is now [password auth](auth-password.md).

Clerk proved too heavy for a personal self-hosted inbox and awkward for the Chrome extension flow. The bundled web UI and extension are designed for:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=password
APP_PASSWORD=generate-a-long-random-password
APP_SESSION_SECRET=generate-a-long-random-secret
EXTENSION_API_TOKEN=generate-a-different-long-random-token
```

The backend still includes a compatibility provider for advanced users who want to build their own Clerk-facing frontend:

```dotenv
AUTH_ENABLED=true
AUTH_PROVIDER=clerk
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ALLOWED_EMAILS=you@example.com
```

Use this only if you are comfortable owning the Clerk UI/session details yourself. For the stock app, use `AUTH_PROVIDER=password`.
