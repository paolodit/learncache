# LearnCache AI Providers

The app separates text summaries from audio transcription.

```dotenv
AI_TEXT_PROVIDER=openai | openrouter | gemini
AI_TRANSCRIBE_PROVIDER=openai | captions-only | local-whisper
```

## Cheapest Path

Use captions first:

```dotenv
AI_TRANSCRIBE_PROVIDER=captions-only
```

This processes captioned YouTube videos without paid transcription. If a YouTube video has no captions, or the item is podcast/audio-only, the job fails with a clear message instead of silently spending money.

## OpenAI

```dotenv
AI_TEXT_PROVIDER=openai
AI_TRANSCRIBE_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_SUMMARY_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

This is the most polished path in LearnCache today.

## OpenRouter

```dotenv
AI_TEXT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_TEXT_MODEL=openrouter/free
```

OpenRouter supports free model routing with `openrouter/free` and free model variants with `:free`. Free availability and rate limits can change, so treat this as best-effort for low-volume use.

Docs:

- [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router)
- [OpenRouter free variants](https://openrouter.ai/docs/guides/routing/model-variants/free)

## Gemini

```dotenv
AI_TEXT_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-3.5-flash
```

Create or manage Gemini API keys in Google AI Studio. Google publishes Gemini API free-tier pricing, but quotas and data-use rules can change by model and account state.

Docs:

- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)

## Local Whisper

```dotenv
AI_TRANSCRIBE_PROVIDER=local-whisper
LOCAL_WHISPER_COMMAND=whisper
LOCAL_WHISPER_MODEL=base
LOCAL_WHISPER_EXTRA_ARGS=
```

The default local command expects the Python `openai-whisper` CLI:

```powershell
pip install -U openai-whisper
```

The app normalizes audio with `ffmpeg`, calls the local Whisper command for each chunk, and reads the generated `.txt` output. This costs no API money, but it uses your CPU/GPU and can be slow.

## Practical Recommendation

- Try `captions-only` first if you mostly save YouTube.
- Use OpenRouter or Gemini for cheap summaries.
- Use OpenAI or local Whisper for audio-only/podcast transcription.
- Do not put provider keys in browser extensions, frontend code, or committed files.
