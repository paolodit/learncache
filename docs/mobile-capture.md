# LearnCache Mobile Capture

Chrome mobile is handled through the web app, not the desktop extension.

## Capture Page

Open:

```text
https://learncache.example.com/capture
```

Paste a YouTube, podcast, or audio URL into the capture box.

The app also supports prefilled links:

```text
https://learncache.example.com/capture?url=https%3A%2F%2Fyoutu.be%2F...
```

## PWA Share Target

The app ships a web manifest with a Web Share Target:

```json
"share_target": {
  "action": "/capture",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

Install the app to your home screen from Chrome. Where supported, it can appear in the system share sheet. Shared URLs may arrive in `url`, `text`, or `title`, so the app scans all three.

Chrome docs: [Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)

## Fallbacks

- Paste into `/capture`.
- Save a browser bookmark to `/capture`.
- Use `/capture?url=...` from shortcuts or automation apps.

The desktop Chrome extension is intentionally not the mobile solution.
