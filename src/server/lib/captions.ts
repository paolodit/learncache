import type { TranscriptSegment } from "../../shared/types.js";

export function parseCaptionText(input: string): TranscriptSegment[] {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  if (normalized.startsWith("WEBVTT")) {
    return parseVtt(normalized);
  }

  return parseSrt(normalized);
}

export function transcriptText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n");
}

function parseVtt(input: string): TranscriptSegment[] {
  const blocks = input
    .replace(/^WEBVTT[^\n]*\n+/i, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const timing = parseTimingLine(lines[timingIndex]);
    if (!timing) continue;

    const text = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
    if (!text) continue;

    const previous = segments.at(-1);
    if (previous && previous.start === timing.start && previous.end === timing.end) {
      previous.text = mergeText(previous.text, text);
      continue;
    }

    segments.push({ start: timing.start, end: timing.end, text });
  }

  return mergeAdjacentDuplicates(segments);
}

function parseSrt(input: string): TranscriptSegment[] {
  const blocks = input
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const timing = parseTimingLine(lines[timingIndex]);
    if (!timing) continue;

    const text = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
    if (text) segments.push({ start: timing.start, end: timing.end, text });
  }

  return mergeAdjacentDuplicates(segments);
}

function parseTimingLine(line: string): { start: number; end: number } | null {
  const [rawStart, rawEnd] = line.split("-->").map((part) => part.trim().split(/\s+/)[0]);
  const start = parseTimestamp(rawStart);
  const end = parseTimestamp(rawEnd);
  if (start === null || end === null) return null;
  return { start, end };
}

export function parseTimestamp(value: string): number | null {
  const normalized = value.replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;

  if (![seconds, minutes, hours].every(Number.isFinite)) return null;
  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

function cleanCaptionText(input: string): string {
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\an\d+\}/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeAdjacentDuplicates(segments: TranscriptSegment[]): TranscriptSegment[] {
  const merged: TranscriptSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && segment.text === previous.text && Math.abs(segment.start - previous.end) < 1) {
      previous.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

function mergeText(first: string, second: string): string {
  return first === second ? first : `${first} ${second}`.replace(/\s+/g, " ").trim();
}
