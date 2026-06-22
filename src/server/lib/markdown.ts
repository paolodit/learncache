import type { ItemDetail, LearningNotes } from "../../shared/types.js";

export function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function renderLearningNotesMarkdown(input: {
  title: string | null;
  creator: string | null;
  url: string;
  canonicalUrl?: string | null;
  durationSeconds?: number | null;
  thumbnailMarkdownUrl?: string | null;
  sourceType?: string | null;
  status?: string | null;
  model?: string | null;
  notes: LearningNotes;
}): string {
  const title = input.title?.trim() || "Untitled item";
  const lines: string[] = [`# ${escapeMarkdown(title)}`, ""];

  if (input.thumbnailMarkdownUrl) {
    lines.push(`![Thumbnail](${input.thumbnailMarkdownUrl})`, "");
  }

  lines.push("## Source", "");
  if (input.creator) lines.push(`- Creator: ${input.creator}`);
  if (input.sourceType) lines.push(`- Type: ${input.sourceType}`);
  if (input.durationSeconds !== undefined && input.durationSeconds !== null) lines.push(`- Duration: ${formatTimestamp(input.durationSeconds)}`);
  lines.push(`- Source: ${formatMarkdownLink(input.url)}`);
  if (input.canonicalUrl && input.canonicalUrl !== input.url) lines.push(`- Canonical: ${formatMarkdownLink(input.canonicalUrl)}`);
  if (input.status) lines.push(`- Status: ${input.status}`);
  if (input.model) lines.push(`- Notes model: ${input.model}`);
  lines.push("");

  lines.push("## TL;DR", "", input.notes.tldr, "");

  lines.push("## Key Ideas", "");
  for (const idea of input.notes.keyIdeas) {
    lines.push(`- ${idea}`);
  }
  lines.push("");

  if (input.notes.timestampedOutline.length > 0) {
    lines.push("## Timestamped Outline", "");
    for (const item of input.notes.timestampedOutline) {
      const timestamp = formatTimestamp(item.timestamp);
      lines.push(`- ${timestamp ? `[${timestamp}] ` : ""}${item.label}: ${item.summary}`);
    }
    lines.push("");
  }

  if (input.notes.notableClaims.length > 0) {
    lines.push("## Notable Claims", "");
    for (const claim of input.notes.notableClaims) {
      const timestamp = formatTimestamp(claim.timestamp);
      lines.push(`- ${timestamp ? `[${timestamp}] ` : ""}${claim.claim} (${claim.support})`);
    }
    lines.push("");
  }

  if (input.notes.followUpQuestions.length > 0) {
    lines.push("## Follow-up Questions", "");
    for (const question of input.notes.followUpQuestions) {
      lines.push(`- ${question}`);
    }
    lines.push("");
  }

  if (input.notes.tags.length > 0) {
    lines.push("## Tags", "", input.notes.tags.map((tag) => `#${slugifyTag(tag)}`).join(" "), "");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function renderItemExportMarkdown(item: ItemDetail, options: { thumbnailMarkdownUrl?: string | null } = {}): string {
  const parts: string[] = [];
  if (item.summary) {
    parts.push(
      renderLearningNotesMarkdown({
        title: item.title,
        creator: item.creator,
        url: item.url,
        canonicalUrl: item.canonicalUrl,
        durationSeconds: item.durationSeconds,
        thumbnailMarkdownUrl: options.thumbnailMarkdownUrl ?? item.thumbnailUrl,
        sourceType: item.sourceType,
        status: item.status,
        model: item.summary.model,
        notes: item.summary.notes
      }).trim()
    );
  }

  if (item.transcript) {
    parts.push("## Transcript", "", item.transcript.text.trim());
  }

  return `${parts.join("\n\n").trim()}\n`;
}

export function itemExportJson(item: ItemDetail): Record<string, unknown> {
  return {
    id: item.id,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    sourceType: item.sourceType,
    title: item.title,
    creator: item.creator,
    durationSeconds: item.durationSeconds,
    thumbnailUrl: item.thumbnailUrl,
    thumbnailPath: item.thumbnailPath,
    thumbnailMimeType: item.thumbnailMimeType,
    thumbnailCachedAt: item.thumbnailCachedAt,
    status: item.status,
    source: {
      originalUrl: item.url,
      canonicalUrl: item.canonicalUrl,
      sourceType: item.sourceType
    },
    transcript: item.transcript,
    summary: item.summary
  };
}

function formatMarkdownLink(url: string): string {
  return `[${url}](${url})`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/^#/g, "\\#");
}

function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
