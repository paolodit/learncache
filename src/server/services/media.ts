import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { TranscriptSegment } from "../../shared/types.js";
import { parseCaptionText, transcriptText } from "../lib/captions.js";
import { extensionFromPath } from "../lib/url.js";
import { config } from "../config.js";
import { assertCommand, runCommand } from "./command.js";

const AUDIO_INSTALL_HINT = "Install ffmpeg globally or place ffmpeg.exe in tools/bin before processing audio.";
const YTDLP_INSTALL_HINT = "Run scripts/install-ytdlp.ps1 or install yt-dlp globally before processing YouTube links.";
const MAX_OPENAI_UPLOAD_BYTES = 24 * 1024 * 1024;

interface CaptionTrack {
  url: string;
  ext?: string;
  name?: string;
}

interface YtDlpMetadata {
  id?: string;
  webpage_url?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  subtitles?: Record<string, CaptionTrack[]>;
  automatic_captions?: Record<string, CaptionTrack[]>;
}

export interface MediaMetadata {
  title: string | null;
  creator: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  canonicalUrl: string | null;
}

export interface CaptionResult {
  language: string | null;
  segments: TranscriptSegment[];
  text: string;
}

export async function assertYouTubeTools(): Promise<void> {
  await assertCommand("yt-dlp", ["--version"], YTDLP_INSTALL_HINT);
}

export async function assertAudioTools(): Promise<void> {
  await assertCommand("ffmpeg", ["-version"], AUDIO_INSTALL_HINT);
}

export async function createTempWorkDir(prefix = "learncache-"): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function readYouTubeMetadata(url: string): Promise<{ raw: YtDlpMetadata; metadata: MediaMetadata }> {
  await assertYouTubeTools();
  const result = await runCommand("yt-dlp", [...ytDlpSharedArgs(), "--dump-single-json", "--skip-download", "--no-warnings", "--no-playlist", url], {
    maxBuffer: 1024 * 1024 * 50
  });
  const raw = JSON.parse(result.stdout) as YtDlpMetadata;

  return {
    raw,
    metadata: {
      title: raw.title ?? null,
      creator: raw.uploader ?? raw.channel ?? null,
      durationSeconds: typeof raw.duration === "number" ? raw.duration : null,
      thumbnailUrl: raw.thumbnail ?? null,
      canonicalUrl: raw.webpage_url ?? null
    }
  };
}

export async function fetchYouTubeCaptions(metadata: YtDlpMetadata): Promise<CaptionResult | null> {
  const selected = selectCaptionTrack(metadata.subtitles) ?? selectCaptionTrack(metadata.automatic_captions);
  if (!selected) return null;

  const response = await fetch(selected.track.url);
  if (!response.ok) {
    throw new Error(`Caption download failed with HTTP ${response.status}.`);
  }

  const captionBody = await response.text();
  const segments = parseCaptionText(captionBody);
  if (segments.length === 0) return null;

  return {
    language: selected.language,
    segments,
    text: transcriptText(segments)
  };
}

export async function downloadYouTubeAudio(url: string, workDir: string): Promise<string> {
  await assertYouTubeTools();
  await assertAudioTools();

  const outputPattern = path.join(workDir, "source.%(ext)s");
  await runCommand(
    "yt-dlp",
    [
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "5",
      "--no-playlist",
      ...ytDlpSharedArgs(),
      "-o",
      outputPattern,
      url
    ],
    { maxBuffer: 1024 * 1024 * 20 }
  );

  const files = await fsp.readdir(workDir);
  const audio = files.find((file) => file.startsWith("source.") && /\.(mp3|m4a|webm|wav|mp4|opus|ogg)$/i.test(file));
  if (!audio) {
    throw new Error("yt-dlp did not produce an audio file.");
  }

  return path.join(workDir, audio);
}

export async function resolvePodcastAudioUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  const extension = extensionFromPath(parsed.pathname);
  if (extension && isLikelyAudioExtension(extension)) return url;

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Podcast page fetch failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("audio/")) return response.url;

  const html = await response.text();
  const discovered = findAudioUrlInHtml(html, response.url);
  if (!discovered) {
    throw new Error("No direct audio URL was found on that podcast page.");
  }

  return discovered;
}

export async function downloadRemoteAudio(url: string, workDir: string): Promise<{ filePath: string; title: string | null }> {
  await assertAudioTools();

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Audio download failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = extensionFromPath(new URL(response.url).pathname) ?? extensionFromContentType(contentType);
  if (!contentType.startsWith("audio/") && !contentType.includes("octet-stream") && !extension) {
    throw new Error("The resolved URL does not look like an audio file.");
  }

  const safeExtension = extension && isLikelyAudioExtension(extension) ? extension : "mp3";
  const filePath = path.join(workDir, `remote-audio.${safeExtension}`);
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(filePath));

  return {
    filePath,
    title: readableTitleFromUrl(response.url)
  };
}

export async function chunkAudioForOpenAI(inputPath: string, workDir: string): Promise<string[]> {
  await assertAudioTools();

  const normalizedPath = path.join(workDir, "normalized.mp3");
  await runCommand("ffmpeg", ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", normalizedPath], {
    maxBuffer: 1024 * 1024 * 20
  });

  const normalizedStats = await fsp.stat(normalizedPath);
  if (normalizedStats.size <= MAX_OPENAI_UPLOAD_BYTES) {
    return [normalizedPath];
  }

  const chunkDir = path.join(workDir, "chunks");
  await fsp.mkdir(chunkDir, { recursive: true });
  await runCommand("ffmpeg", ["-y", "-i", normalizedPath, "-f", "segment", "-segment_time", "1200", "-c", "copy", path.join(chunkDir, "chunk-%03d.mp3")], {
    maxBuffer: 1024 * 1024 * 20
  });

  const chunks = (await fsp.readdir(chunkDir))
    .filter((file) => file.endsWith(".mp3"))
    .sort()
    .map((file) => path.join(chunkDir, file));

  if (chunks.length === 0) {
    throw new Error("ffmpeg did not produce any audio chunks.");
  }

  for (const chunk of chunks) {
    const stats = await fsp.stat(chunk);
    if (stats.size > MAX_OPENAI_UPLOAD_BYTES) {
      throw new Error(`Audio chunk ${path.basename(chunk)} is still larger than 24 MB after normalization.`);
    }
  }

  return chunks;
}

export async function removeWorkDir(workDir: string): Promise<void> {
  await fsp.rm(workDir, { recursive: true, force: true });
}

function ytDlpSharedArgs(): string[] {
  const cookiesPath = config.ytdlpCookiesPath.trim();
  return cookiesPath ? ["--cookies", cookiesPath] : [];
}

function selectCaptionTrack(groups: Record<string, CaptionTrack[]> | undefined): { language: string; track: CaptionTrack } | null {
  if (!groups) return null;

  const languages = Object.keys(groups);
  const preferredLanguages = [
    ...languages.filter((language) => language.toLowerCase() === "en"),
    ...languages.filter((language) => language.toLowerCase().startsWith("en")),
    ...languages
  ];

  for (const language of preferredLanguages) {
    const tracks = groups[language] ?? [];
    const track =
      tracks.find((candidate) => candidate.url && candidate.ext === "vtt") ??
      tracks.find((candidate) => candidate.url && candidate.ext === "srt") ??
      tracks.find((candidate) => candidate.url);

    if (track) return { language, track };
  }

  return null;
}

function findAudioUrlInHtml(html: string, baseUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:audio(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i,
    /<audio[^>]+src=["']([^"']+)["']/i,
    /<source[^>]+src=["']([^"']+)["'][^>]+type=["']audio\/[^"']+["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']audio\/[^"']+["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return new URL(decodeHtmlAttribute(match[1]), baseUrl).toString();
    }
  }

  return null;
}

function decodeHtmlAttribute(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function extensionFromContentType(contentType: string): string | null {
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("mp4")) return "m4a";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("ogg")) return "ogg";
  return null;
}

function isLikelyAudioExtension(extension: string): boolean {
  return ["mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga", "aac", "ogg", "opus"].includes(extension.toLowerCase());
}

function readableTitleFromUrl(url: string): string | null {
  const pathname = new URL(url).pathname;
  const name = pathname.split("/").filter(Boolean).pop();
  if (!name) return null;
  return decodeURIComponent(name)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}
