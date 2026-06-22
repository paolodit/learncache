import { randomUUID } from "node:crypto";
import type {
  ItemDetail,
  ItemStatus,
  ItemSummary,
  JobStatus,
  JobType,
  LearningNotes,
  LogLevel,
  ProcessingLog,
  SourceType,
  SummaryRecord,
  TranscriptRecord,
  TranscriptSegment,
  TranscriptSource
} from "../../shared/types.js";
import { buildFtsQuery } from "../lib/search.js";
import { sqliteAll, sqliteGet, sqliteRun } from "./client.js";

const MAX_LOGS_PER_ITEM = 100;

export interface StoredItem {
  id: string;
  url: string;
  canonicalUrl: string;
  sourceType: SourceType;
  title: string | null;
  creator: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  thumbnailMimeType: string | null;
  thumbnailCachedAt: number | null;
  status: ItemStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

interface DbItemRow {
  id: string;
  url: string;
  canonical_url: string;
  source_type: SourceType;
  title: string | null;
  creator: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  thumbnail_mime_type: string | null;
  thumbnail_cached_at: number | null;
  status: ItemStatus;
  error: string | null;
  created_at: number;
  updated_at: number;
}

interface DbTranscriptRow {
  id: string;
  item_id: string;
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments_json: string;
  created_at: number;
  updated_at: number;
}

interface DbSummaryRow {
  id: string;
  item_id: string;
  model: string;
  tldr: string;
  key_ideas_json: string;
  outline_json: string;
  claims_json: string;
  tags_json: string;
  questions_json: string;
  rendered_markdown: string;
  created_at: number;
  updated_at: number;
}

interface DbJobRow {
  id: string;
  item_id: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  next_run_at: number;
  error: string | null;
  created_at: number;
  updated_at: number;
}

interface DbLogRow {
  id: string;
  item_id: string;
  level: LogLevel;
  message: string;
  created_at: number;
}

export interface StoredJob {
  id: string;
  itemId: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  nextRunAt: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateItemInput {
  url: string;
  canonicalUrl: string;
  sourceType: SourceType;
}

export function nowMs(): number {
  return Date.now();
}

export function createId(): string {
  return randomUUID();
}

export function mapItem(row: StoredItem, tags: string[] = []): ItemSummary {
  return {
    id: row.id,
    url: row.url,
    canonicalUrl: row.canonicalUrl,
    sourceType: row.sourceType,
    title: row.title,
    creator: row.creator,
    durationSeconds: row.durationSeconds,
    thumbnailUrl: row.thumbnailUrl,
    thumbnailPath: row.thumbnailPath,
    thumbnailMimeType: row.thumbnailMimeType,
    thumbnailCachedAt: row.thumbnailCachedAt,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags
  };
}

export function parseJsonArray<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function tagsForItems(itemIds: string[]): Map<string, string[]> {
  if (itemIds.length === 0) return new Map();
  const placeholders = itemIds.map(() => "?").join(", ");
  const rows = sqliteAll<{ item_id: string; tags_json: string }>(
    `SELECT item_id, tags_json FROM summaries WHERE item_id IN (${placeholders})`,
    itemIds
  );
  return new Map(rows.map((row) => [row.item_id, parseJsonArray<string[]>(row.tags_json, [])]));
}

export function findItemByCanonicalUrl(canonicalUrl: string): ItemSummary | null {
  const row = getItemByColumn("canonical_url", canonicalUrl);
  if (!row) return null;
  const tagMap = tagsForItems([row.id]);
  return mapItem(row, tagMap.get(row.id) ?? []);
}

export function createItem(input: CreateItemInput): ItemSummary {
  const timestamp = nowMs();
  const row: StoredItem = {
    id: createId(),
    url: input.url,
    canonicalUrl: input.canonicalUrl,
    sourceType: input.sourceType,
    title: null,
    creator: null,
    durationSeconds: null,
    thumbnailUrl: null,
    thumbnailPath: null,
    thumbnailMimeType: null,
    thumbnailCachedAt: null,
    status: "queued",
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  sqliteRun(
    `INSERT INTO items (
      id, url, canonical_url, source_type, title, creator, duration_seconds, thumbnail_url,
      thumbnail_path, thumbnail_mime_type, thumbnail_cached_at, status, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.url,
      row.canonicalUrl,
      row.sourceType,
      row.title,
      row.creator,
      row.durationSeconds,
      row.thumbnailUrl,
      row.thumbnailPath,
      row.thumbnailMimeType,
      row.thumbnailCachedAt,
      row.status,
      row.error,
      row.createdAt,
      row.updatedAt
    ]
  );
  refreshSearchIndex(row.id);
  return mapItem(row);
}

export function updateItem(
  itemId: string,
  patch: Partial<
    Pick<
      StoredItem,
      | "title"
      | "creator"
      | "durationSeconds"
      | "thumbnailUrl"
      | "thumbnailPath"
      | "thumbnailMimeType"
      | "thumbnailCachedAt"
      | "status"
      | "error"
      | "sourceType"
      | "canonicalUrl"
    >
  >
): void {
  const columnMap: Record<keyof typeof patch, string> = {
    title: "title",
    creator: "creator",
    durationSeconds: "duration_seconds",
    thumbnailUrl: "thumbnail_url",
    thumbnailPath: "thumbnail_path",
    thumbnailMimeType: "thumbnail_mime_type",
    thumbnailCachedAt: "thumbnail_cached_at",
    status: "status",
    error: "error",
    sourceType: "source_type",
    canonicalUrl: "canonical_url"
  };

  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${columnMap[key as keyof typeof patch]} = ?`).join(", ");
  sqliteRun(`UPDATE items SET ${assignments}, updated_at = ? WHERE id = ?`, [
    ...entries.map(([, value]) => value),
    nowMs(),
    itemId
  ]);
  refreshSearchIndex(itemId);
}

export function getItemRow(itemId: string): StoredItem | null {
  return getItemByColumn("id", itemId);
}

export function getItemDetail(itemId: string): ItemDetail | null {
  const item = getItemRow(itemId);
  if (!item) return null;

  const transcriptRow = sqliteGet<DbTranscriptRow>("SELECT * FROM transcripts WHERE item_id = ?", [itemId]);
  const summaryRow = sqliteGet<DbSummaryRow>("SELECT * FROM summaries WHERE item_id = ?", [itemId]);
  const logs = sqliteAll<DbLogRow>("SELECT * FROM processing_logs WHERE item_id = ? ORDER BY created_at DESC LIMIT ?", [
    itemId,
    MAX_LOGS_PER_ITEM
  ])
    .reverse()
    .map(mapLog);

  const summary = summaryRow ? mapSummary(summaryRow) : null;
  return {
    ...mapItem(item, summary?.notes.tags ?? []),
    transcript: transcriptRow ? mapTranscript(transcriptRow) : null,
    summary,
    logs
  };
}

export interface ListItemsFilters {
  query?: string;
  status?: ItemStatus | "all";
  source?: SourceType | "all";
}

export function listItems(filters: ListItemsFilters): ItemSummary[] {
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (filters.status && filters.status !== "all") {
    whereParts.push("items.status = ?");
    params.push(filters.status);
  }

  if (filters.source && filters.source !== "all") {
    whereParts.push("items.source_type = ?");
    params.push(filters.source);
  }

  const ftsQuery = buildFtsQuery(filters.query ?? "");
  let sql = "SELECT items.* FROM items";
  if (ftsQuery) {
    sql += " JOIN item_search ON item_search.item_id = items.id";
    whereParts.push("item_search MATCH ?");
    params.push(ftsQuery);
  }

  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(" AND ")}`;
  }

  sql += " ORDER BY items.updated_at DESC LIMIT 100";

  const itemRows = sqliteAll<DbItemRow>(sql, params).map(mapDbItem);
  const tagMap = tagsForItems(itemRows.map((item) => item.id));
  return itemRows.map((item) => mapItem(item, tagMap.get(item.id) ?? []));
}

export function deleteItem(itemId: string): void {
  sqliteRun("DELETE FROM items WHERE id = ?", [itemId]);
  sqliteRun("DELETE FROM item_search WHERE item_id = ?", [itemId]);
}

export function upsertTranscript(input: {
  itemId: string;
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}): TranscriptRecord {
  const timestamp = nowMs();
  const existing = sqliteGet<DbTranscriptRow>("SELECT * FROM transcripts WHERE item_id = ?", [input.itemId]);
  const row = {
    id: existing?.id ?? createId(),
    itemId: input.itemId,
    source: input.source,
    language: input.language,
    text: input.text,
    segmentsJson: JSON.stringify(input.segments),
    createdAt: existing?.created_at ?? timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    sqliteRun(
      "UPDATE transcripts SET source = ?, language = ?, text = ?, segments_json = ?, updated_at = ? WHERE id = ?",
      [row.source, row.language, row.text, row.segmentsJson, row.updatedAt, row.id]
    );
  } else {
    sqliteRun(
      "INSERT INTO transcripts (id, item_id, source, language, text, segments_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [row.id, row.itemId, row.source, row.language, row.text, row.segmentsJson, row.createdAt, row.updatedAt]
    );
  }

  refreshSearchIndex(input.itemId);
  return mapTranscriptFromCamel(row);
}

export function upsertSummary(input: { itemId: string; model: string; notes: LearningNotes; renderedMarkdown: string }): SummaryRecord {
  const timestamp = nowMs();
  const existing = sqliteGet<DbSummaryRow>("SELECT * FROM summaries WHERE item_id = ?", [input.itemId]);
  const row = {
    id: existing?.id ?? createId(),
    itemId: input.itemId,
    model: input.model,
    tldr: input.notes.tldr,
    keyIdeasJson: JSON.stringify(input.notes.keyIdeas),
    outlineJson: JSON.stringify(input.notes.timestampedOutline),
    claimsJson: JSON.stringify(input.notes.notableClaims),
    tagsJson: JSON.stringify(input.notes.tags),
    questionsJson: JSON.stringify(input.notes.followUpQuestions),
    renderedMarkdown: input.renderedMarkdown,
    createdAt: existing?.created_at ?? timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    sqliteRun(
      `UPDATE summaries SET
        model = ?, tldr = ?, key_ideas_json = ?, outline_json = ?, claims_json = ?,
        tags_json = ?, questions_json = ?, rendered_markdown = ?, updated_at = ?
      WHERE id = ?`,
      [
        row.model,
        row.tldr,
        row.keyIdeasJson,
        row.outlineJson,
        row.claimsJson,
        row.tagsJson,
        row.questionsJson,
        row.renderedMarkdown,
        row.updatedAt,
        row.id
      ]
    );
  } else {
    sqliteRun(
      `INSERT INTO summaries (
        id, item_id, model, tldr, key_ideas_json, outline_json, claims_json,
        tags_json, questions_json, rendered_markdown, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.itemId,
        row.model,
        row.tldr,
        row.keyIdeasJson,
        row.outlineJson,
        row.claimsJson,
        row.tagsJson,
        row.questionsJson,
        row.renderedMarkdown,
        row.createdAt,
        row.updatedAt
      ]
    );
  }

  refreshSearchIndex(input.itemId);
  return mapSummaryFromCamel(row);
}

export function refreshSearchIndex(itemId: string): void {
  const item = getItemRow(itemId);
  if (!item) return;

  const transcript = sqliteGet<DbTranscriptRow>("SELECT * FROM transcripts WHERE item_id = ?", [itemId]);
  const summary = sqliteGet<DbSummaryRow>("SELECT * FROM summaries WHERE item_id = ?", [itemId]);

  sqliteRun("DELETE FROM item_search WHERE item_id = ?", [itemId]);
  sqliteRun("INSERT INTO item_search (item_id, title, transcript, summary, tags) VALUES (?, ?, ?, ?, ?)", [
    itemId,
    [item.title, item.creator, item.url].filter(Boolean).join(" "),
    transcript?.text ?? "",
    summary?.rendered_markdown ?? "",
    summary ? parseJsonArray<string[]>(summary.tags_json, []).join(" ") : ""
  ]);
}

export function enqueueIngestJob(itemId: string): void {
  const timestamp = nowMs();
  sqliteRun(
    `INSERT INTO jobs (id, item_id, type, status, attempts, next_run_at, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [createId(), itemId, "ingest", "queued", 0, timestamp, null, timestamp, timestamp]
  );
}

export function nextDueJob(): StoredJob | null {
  const row = sqliteGet<DbJobRow>(
    `SELECT * FROM jobs
     WHERE status IN ('queued', 'failed') AND next_run_at <= ? AND attempts <= 2
     ORDER BY next_run_at ASC, created_at ASC LIMIT 1`,
    [nowMs()]
  );
  return row ? mapJob(row) : null;
}

export function markJobRunning(jobId: string): void {
  sqliteRun("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?", [nowMs(), jobId]);
}

export function markJobComplete(jobId: string): void {
  sqliteRun("UPDATE jobs SET status = 'complete', error = NULL, updated_at = ? WHERE id = ?", [nowMs(), jobId]);
}

export function markJobFailed(jobId: string, attempts: number, error: string, retryAt: number | null): void {
  sqliteRun("UPDATE jobs SET status = 'failed', attempts = ?, error = ?, next_run_at = ?, updated_at = ? WHERE id = ?", [
    attempts,
    error,
    retryAt ?? nowMs(),
    nowMs(),
    jobId
  ]);
}

export function markStaleRunningJobsQueued(): void {
  sqliteRun("UPDATE jobs SET status = 'queued', updated_at = ? WHERE status = 'running'", [nowMs()]);
}

export function addLog(itemId: string, level: LogLevel, message: string): ProcessingLog {
  const row = {
    id: createId(),
    itemId,
    level,
    message,
    createdAt: nowMs()
  };
  sqliteRun("INSERT INTO processing_logs (id, item_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)", [
    row.id,
    row.itemId,
    row.level,
    row.message,
    row.createdAt
  ]);
  return row;
}

function getItemByColumn(column: "id" | "canonical_url", value: string): StoredItem | null {
  const row = sqliteGet<DbItemRow>(`SELECT * FROM items WHERE ${column} = ?`, [value]);
  return row ? mapDbItem(row) : null;
}

function mapDbItem(row: DbItemRow): StoredItem {
  return {
    id: row.id,
    url: row.url,
    canonicalUrl: row.canonical_url,
    sourceType: row.source_type,
    title: row.title,
    creator: row.creator,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    thumbnailPath: row.thumbnail_path,
    thumbnailMimeType: row.thumbnail_mime_type,
    thumbnailCachedAt: row.thumbnail_cached_at,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTranscript(row: DbTranscriptRow): TranscriptRecord {
  return {
    source: row.source,
    language: row.language,
    text: row.text,
    segments: parseJsonArray<TranscriptSegment[]>(row.segments_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTranscriptFromCamel(row: {
  source: TranscriptSource;
  language: string | null;
  text: string;
  segmentsJson: string;
  createdAt: number;
  updatedAt: number;
}): TranscriptRecord {
  return {
    source: row.source,
    language: row.language,
    text: row.text,
    segments: parseJsonArray<TranscriptSegment[]>(row.segmentsJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSummary(row: DbSummaryRow): SummaryRecord {
  return {
    model: row.model,
    notes: {
      tldr: row.tldr,
      keyIdeas: parseJsonArray<string[]>(row.key_ideas_json, []),
      timestampedOutline: parseJsonArray(row.outline_json, []),
      notableClaims: parseJsonArray(row.claims_json, []),
      tags: parseJsonArray(row.tags_json, []),
      followUpQuestions: parseJsonArray(row.questions_json, [])
    },
    renderedMarkdown: row.rendered_markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSummaryFromCamel(row: {
  model: string;
  tldr: string;
  keyIdeasJson: string;
  outlineJson: string;
  claimsJson: string;
  tagsJson: string;
  questionsJson: string;
  renderedMarkdown: string;
  createdAt: number;
  updatedAt: number;
}): SummaryRecord {
  return {
    model: row.model,
    notes: {
      tldr: row.tldr,
      keyIdeas: parseJsonArray<string[]>(row.keyIdeasJson, []),
      timestampedOutline: parseJsonArray(row.outlineJson, []),
      notableClaims: parseJsonArray(row.claimsJson, []),
      tags: parseJsonArray(row.tagsJson, []),
      followUpQuestions: parseJsonArray(row.questionsJson, [])
    },
    renderedMarkdown: row.renderedMarkdown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapLog(row: DbLogRow): ProcessingLog {
  return {
    id: row.id,
    itemId: row.item_id,
    level: row.level,
    message: row.message,
    createdAt: row.created_at
  };
}

function mapJob(row: DbJobRow): StoredJob {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    nextRunAt: row.next_run_at,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
