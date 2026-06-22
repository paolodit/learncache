export type SourceType = "youtube" | "podcast" | "audio" | "unknown";
export type ItemStatus = "queued" | "processing" | "complete" | "failed";
export type JobStatus = "queued" | "running" | "complete" | "failed";
export type JobType = "ingest";
export type TranscriptSource = "youtube_caption" | "audio_transcription";
export type LogLevel = "info" | "warn" | "error";
export type AiTextProvider = "openai" | "openrouter" | "gemini";
export type AiTranscribeProvider = "openai" | "captions-only" | "local-whisper";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TimestampedOutlineItem {
  timestamp: number | null;
  label: string;
  summary: string;
}

export interface NotableClaim {
  timestamp: number | null;
  claim: string;
  support: string;
}

export interface LearningNotes {
  tldr: string;
  keyIdeas: string[];
  timestampedOutline: TimestampedOutlineItem[];
  notableClaims: NotableClaim[];
  tags: string[];
  followUpQuestions: string[];
}

export interface ItemSummary {
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
  tags: string[];
}

export interface TranscriptRecord {
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
  createdAt: number;
  updatedAt: number;
}

export interface SummaryRecord {
  model: string;
  notes: LearningNotes;
  renderedMarkdown: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProcessingLog {
  id: string;
  itemId: string;
  level: LogLevel;
  message: string;
  createdAt: number;
}

export interface ItemDetail extends ItemSummary {
  transcript: TranscriptRecord | null;
  summary: SummaryRecord | null;
  logs: ProcessingLog[];
}

export interface CreateItemResponse {
  item: ItemSummary;
  duplicate: boolean;
}
