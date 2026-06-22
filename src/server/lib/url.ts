import type { SourceType } from "../../shared/types.js";

const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga", "aac", "ogg", "opus"]);

export interface NormalizedUrl {
  originalUrl: string;
  canonicalUrl: string;
  sourceType: SourceType;
}

export function normalizeCaptureUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste a YouTube, podcast, or audio URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That does not look like a valid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  const sourceType = classifySource(parsed);
  const canonicalUrl = sourceType === "youtube" ? canonicalizeYouTubeUrl(parsed) : canonicalizeGenericUrl(parsed);

  return {
    originalUrl: trimmed,
    canonicalUrl,
    sourceType
  };
}

export function classifySource(url: URL): SourceType {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com" || host.endsWith(".youtube.com")) {
    return "youtube";
  }

  const extension = extensionFromPath(url.pathname);
  if (extension && AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  return "podcast";
}

export function canonicalizeYouTubeUrl(url: URL): string {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const videoId = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");

  if (videoId) {
    const canonical = new URL("https://www.youtube.com/watch");
    canonical.searchParams.set("v", videoId);
    const playlist = url.searchParams.get("list");
    if (playlist) canonical.searchParams.set("list", playlist);
    return canonical.toString();
  }

  return canonicalizeGenericUrl(url);
}

export function canonicalizeGenericUrl(url: URL): string {
  const canonical = new URL(url.toString());
  canonical.hash = "";

  for (const key of [...canonical.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["feature", "si", "fbclid", "gclid"].includes(key.toLowerCase())) {
      canonical.searchParams.delete(key);
    }
  }

  canonical.hostname = canonical.hostname.toLowerCase();
  if (canonical.pathname !== "/" && canonical.pathname.endsWith("/")) {
    canonical.pathname = canonical.pathname.slice(0, -1);
  }

  canonical.searchParams.sort();
  return canonical.toString();
}

export function extensionFromPath(pathname: string): string | null {
  const last = pathname.split("/").pop();
  if (!last || !last.includes(".")) return null;
  return last.split(".").pop()?.toLowerCase() ?? null;
}
