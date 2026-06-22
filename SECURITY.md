# Security Policy

LearnCache is a local-first personal archive tool. Hosted deployments should be treated as private infrastructure.

## Supported Version

This project is early v0 software. Security fixes target the `main` branch.

## Reporting Issues

Please report security issues privately to the repository owner rather than opening a public issue with exploit details.

## Deployment Guidance

- Keep `AUTH_ENABLED=false` only for localhost/private-machine use.
- Use `AUTH_ENABLED=true` with Clerk and `ALLOWED_EMAILS` for public URLs.
- Keep API keys server-side only.
- Do not commit `.env`, `personal/`, SQLite files, thumbnails, logs, exports, or extension builds.
- Keep hosted SQLite to one app instance with a persistent `/data` volume and backups.
