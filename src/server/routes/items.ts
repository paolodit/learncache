import type { FastifyInstance } from "fastify";
import path from "node:path";
import { z } from "zod";
import type { ItemStatus, SourceType } from "../../shared/types.js";
import { itemExportJson, renderItemExportMarkdown } from "../lib/markdown.js";
import { normalizeCaptureUrl } from "../lib/url.js";
import { createZip } from "../lib/zip.js";
import { readCachedThumbnail, removeCachedThumbnail } from "../services/thumbnail.js";
import {
  addLog,
  createItem,
  deleteItem,
  enqueueIngestJob,
  findItemByCanonicalUrl,
  getItemDetail,
  listItems,
  updateItem
} from "../db/repository.js";

const createItemSchema = z.object({
  url: z.string().min(1)
});

const listQuerySchema = z.object({
  query: z.string().optional(),
  status: z.enum(["all", "queued", "processing", "complete", "failed"]).optional(),
  source: z.enum(["all", "youtube", "podcast", "audio", "unknown"]).optional()
});

export async function registerItemRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/items", async (request, reply) => {
    const body = createItemSchema.parse(request.body);
    const normalized = normalizeCaptureUrl(body.url);
    const existing = findItemByCanonicalUrl(normalized.canonicalUrl);
    if (existing) {
      return { item: existing, duplicate: true };
    }

    const item = createItem({
      url: normalized.originalUrl,
      canonicalUrl: normalized.canonicalUrl,
      sourceType: normalized.sourceType
    });
    addLog(item.id, "info", "Item captured.");
    enqueueIngestJob(item.id);
    reply.code(201);
    return { item, duplicate: false };
  });

  app.get("/api/items", async (request) => {
    const query = listQuerySchema.parse(request.query);
    return {
      items: listItems({
        query: query.query,
        status: query.status as ItemStatus | "all" | undefined,
        source: query.source as SourceType | "all" | undefined
      })
    };
  });

  app.get("/api/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    return { item };
  });

  app.post("/api/items/:id/reprocess", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    updateItem(id, { status: "queued", error: null });
    addLog(id, "info", "Reprocess requested.");
    enqueueIngestJob(id);
    return { item: getItemDetail(id) };
  });

  app.delete("/api/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    deleteItem(id);
    await removeCachedThumbnail(item.thumbnailPath);
    reply.code(204);
    return null;
  });

  app.get("/api/items/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    const thumbnail = await readCachedThumbnail(item.thumbnailPath);
    if (!thumbnail) {
      reply.code(404);
      return { error: "Thumbnail not found." };
    }

    reply.header("Content-Type", item.thumbnailMimeType ?? "image/jpeg");
    reply.header("Cache-Control", "private, max-age=86400");
    return thumbnail;
  });

  app.get("/api/items/:id/export.md", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return "Item not found.";
    }

    reply.header("Content-Type", "text/markdown; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${safeFileName(item.title ?? item.id)}.md"`);
    return renderItemExportMarkdown(item);
  });

  app.get("/api/items/:id/export.json", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    reply.header("Content-Disposition", `attachment; filename="${safeFileName(item.title ?? item.id)}.json"`);
    return itemExportJson(item);
  });

  app.get("/api/items/:id/export.zip", async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = getItemDetail(id);
    if (!item) {
      reply.code(404);
      return { error: "Item not found." };
    }

    const entries = [];
    const thumbnail = await readCachedThumbnail(item.thumbnailPath);
    const thumbnailName = thumbnail ? `assets/${thumbnailFileName(item.thumbnailPath, item.thumbnailMimeType)}` : null;
    entries.push({
      name: "notes.md",
      data: Buffer.from(renderItemExportMarkdown(item, { thumbnailMarkdownUrl: thumbnailName ?? item.thumbnailUrl }), "utf8")
    });
    entries.push({
      name: "item.json",
      data: Buffer.from(`${JSON.stringify(itemExportJson(item), null, 2)}\n`, "utf8")
    });
    if (thumbnail && thumbnailName) {
      entries.push({
        name: thumbnailName,
        data: thumbnail
      });
    }

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${safeFileName(item.title ?? item.id)}.zip"`);
    return createZip(entries);
  });
}

function safeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "") || "learning-notes";
}

function thumbnailFileName(thumbnailPath: string | null, mimeType: string | null): string {
  const existingName = thumbnailPath ? path.posix.basename(thumbnailPath.replace(/\\/g, "/")) : "";
  if (existingName) return existingName;
  if (mimeType === "image/png") return "thumbnail.png";
  if (mimeType === "image/webp") return "thumbnail.webp";
  if (mimeType === "image/gif") return "thumbnail.gif";
  return "thumbnail.jpg";
}
