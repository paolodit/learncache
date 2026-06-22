import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "../config.js";

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024;

export interface CachedThumbnail {
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  cachedAt: number;
}

export async function cacheThumbnail(itemId: string, thumbnailUrl: string): Promise<CachedThumbnail | null> {
  const response = await fetch(thumbnailUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`thumbnail download failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`thumbnail response was ${contentType || "an unknown content type"}`);
  }

  const extension = extensionFromMime(contentType) ?? extensionFromPath(new URL(response.url).pathname) ?? "jpg";
  const relativePath = `thumbnails/${safeFilePart(itemId)}.${extension}`;
  const absolutePath = path.join(config.dataDir, relativePath);
  await fsp.mkdir(path.dirname(absolutePath), { recursive: true });

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(response.body as never)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
    bytes += buffer.length;
    if (bytes > MAX_THUMBNAIL_BYTES) {
      throw new Error("thumbnail was larger than 8 MB");
    }
    chunks.push(buffer);
  }

  await fsp.writeFile(absolutePath, Buffer.concat(chunks));
  return {
    relativePath,
    absolutePath,
    mimeType: contentType,
    cachedAt: Date.now()
  };
}

export function resolveCachedThumbnail(relativePath: string | null): string | null {
  if (!relativePath) return null;
  const absolutePath = path.resolve(config.dataDir, relativePath);
  const dataRoot = path.resolve(config.dataDir);
  if (absolutePath !== dataRoot && !absolutePath.startsWith(`${dataRoot}${path.sep}`)) return null;
  return absolutePath;
}

export async function removeCachedThumbnail(relativePath: string | null): Promise<void> {
  const absolutePath = resolveCachedThumbnail(relativePath);
  if (!absolutePath) return;
  await fsp.rm(absolutePath, { force: true });
}

export async function readCachedThumbnail(relativePath: string | null): Promise<Buffer | null> {
  const absolutePath = resolveCachedThumbnail(relativePath);
  if (!absolutePath) return null;
  try {
    return await fsp.readFile(absolutePath);
  } catch {
    return null;
  }
}

function extensionFromMime(mimeType: string): string | null {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return null;
}

function extensionFromPath(pathname: string): string | null {
  const extension = pathname.split(".").pop()?.toLowerCase();
  if (!extension || !["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) return null;
  return extension === "jpeg" ? "jpg" : extension;
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}
