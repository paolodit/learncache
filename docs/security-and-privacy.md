# LearnCache Security And Privacy

LearnCache is a personal archive app. It is not a DRM bypasser, paywall bypasser, or hosted multi-tenant SaaS.

## Local Mode

With `AUTH_ENABLED=false`, anyone who can access the local server can access the inbox. Keep local mode bound to localhost:

```dotenv
API_HOST=127.0.0.1
```

## Hosted Mode

For a public URL:

```dotenv
AUTH_ENABLED=true
ALLOWED_EMAILS=you@example.com
```

The backend protects API data, thumbnails, and exports. Do not expose hosted mode without auth.

## Secrets

Keep these server-side only:

- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `CLERK_SECRET_KEY`

The frontend and extension may receive Clerk publishable keys, but never AI provider keys.

## Stored Data

The app stores:

- Original and canonical source URLs
- Titles, creators/channels, duration, remote thumbnail URL
- Local cached thumbnail files
- Transcripts and generated summaries
- Processing logs
- SQLite FTS search index

Raw downloaded audio and chunks are temporary and are deleted after processing.

## Backups And Deletion

Deleting an item removes database rows and the cached thumbnail file. SQLite may retain historical bytes in WAL pages until checkpoint/vacuum behavior catches up, so treat full-disk backups as sensitive.

## Content Rights

Only process content you have rights or permission to process. Some platforms prohibit downloading or automated processing in their terms.
