# Contributing To LearnCache

Thanks for helping improve LearnCache.

## Local Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Use sample/local data when testing UI or screenshots. Do not commit personal domains, provider keys, transcripts, local databases, generated exports, or cached thumbnails.

## Checks

Run these before opening a pull request:

```powershell
npm test
npm run build
```

For extension changes:

```powershell
cd extension
npm install
npm run build
```

## Project Direction

LearnCache is local-first by default. Keep hosted features optional, keep SQLite portable, and prefer explicit configuration over hidden external services.
