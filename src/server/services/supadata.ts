import type { TranscriptSegment } from "../../shared/types.js";
import { config, requireSupadataKey } from "../config.js";
import { transcriptText } from "../lib/captions.js";

interface SupadataTranscriptResponse {
  content?: unknown;
  transcript?: unknown;
  text?: unknown;
  lang?: unknown;
  language?: unknown;
}

export interface SupadataTranscriptResult {
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}

export async function fetchSupadataYouTubeTranscript(url: string): Promise<SupadataTranscriptResult | null> {
  const requestUrl = new URL("https://api.supadata.ai/v1/transcript");
  requestUrl.searchParams.set("url", url);
  requestUrl.searchParams.set("text", "false");
  requestUrl.searchParams.set("mode", config.supadataTranscriptMode);
  if (config.supadataLang.trim()) {
    requestUrl.searchParams.set("lang", config.supadataLang.trim());
  }

  const response = await fetch(requestUrl, {
    headers: {
      "x-api-key": requireSupadataKey()
    }
  });

  if (response.status === 404 || response.status === 204 || response.status === 206) return null;

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supadata transcript request failed with HTTP ${response.status}: ${body}`);
  }

  const parsed = JSON.parse(body) as SupadataTranscriptResponse;
  const segments = normalizeSegments(parsed.content ?? parsed.transcript ?? parsed.text);
  const text = segments.length > 0 ? transcriptText(segments) : normalizeText(parsed.content ?? parsed.transcript ?? parsed.text);
  if (!text.trim()) return null;

  return {
    language: typeof parsed.lang === "string" ? parsed.lang : typeof parsed.language === "string" ? parsed.language : config.supadataLang || null,
    text,
    segments: segments.length > 0 ? segments : textToSegments(text)
  };
}

function normalizeSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        return { start: index, end: index + 1, text: entry.trim() };
      }

      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const text = normalizeText(record.text ?? record.content ?? record.caption ?? record.sentence);
      if (!text) return null;

      const start = numberFrom(record.start ?? record.startTime ?? record.offset ?? record.offsetMs, index);
      const duration = numberFrom(record.duration ?? record.dur, 0);
      const end = numberFrom(record.end ?? record.endTime, start + duration);
      return {
        start,
        end: Math.max(start, end),
        text
      };
    })
    .filter((segment): segment is TranscriptSegment => Boolean(segment?.text));
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : normalizeText((entry as Record<string, unknown>)?.text ?? (entry as Record<string, unknown>)?.content)))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function numberFrom(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number > 10_000 ? number / 1000 : number;
}

function textToSegments(text: string): TranscriptSegment[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ start: index, end: index + 1, text: line }));
}
