import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ItemStatus, JobStatus, JobType, LogLevel, SourceType, TranscriptSource } from "../../shared/types.js";

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    sourceType: text("source_type").$type<SourceType>().notNull(),
    title: text("title"),
    creator: text("creator"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailPath: text("thumbnail_path"),
    thumbnailMimeType: text("thumbnail_mime_type"),
    thumbnailCachedAt: integer("thumbnail_cached_at"),
    status: text("status").$type<ItemStatus>().notNull(),
    error: text("error"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    canonicalUrlUnique: uniqueIndex("items_canonical_url_unique").on(table.canonicalUrl)
  })
);

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    source: text("source").$type<TranscriptSource>().notNull(),
    language: text("language"),
    text: text("text").notNull(),
    segmentsJson: text("segments_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    itemIdUnique: uniqueIndex("transcripts_item_id_unique").on(table.itemId)
  })
);

export const summaries = sqliteTable(
  "summaries",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    tldr: text("tldr").notNull(),
    keyIdeasJson: text("key_ideas_json").notNull(),
    outlineJson: text("outline_json").notNull(),
    claimsJson: text("claims_json").notNull(),
    tagsJson: text("tags_json").notNull(),
    questionsJson: text("questions_json").notNull(),
    renderedMarkdown: text("rendered_markdown").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    itemIdUnique: uniqueIndex("summaries_item_id_unique").on(table.itemId)
  })
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    type: text("type").$type<JobType>().notNull(),
    status: text("status").$type<JobStatus>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextRunAt: integer("next_run_at").notNull(),
    error: text("error"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
  },
  (table) => ({
    dueIdx: index("jobs_due_idx").on(table.status, table.nextRunAt)
  })
);

export const processingLogs = sqliteTable(
  "processing_logs",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    level: text("level").$type<LogLevel>().notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull()
  },
  (table) => ({
    itemIdx: index("processing_logs_item_id_idx").on(table.itemId, table.createdAt)
  })
);

export const schema = {
  items,
  transcripts,
  summaries,
  jobs,
  processingLogs
};
