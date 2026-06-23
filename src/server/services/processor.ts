import type { TranscriptSegment, TranscriptSource } from "../../shared/types.js";
import { config, summaryModelId } from "../config.js";
import { transcriptText } from "../lib/captions.js";
import { renderLearningNotesMarkdown } from "../lib/markdown.js";
import {
  addLog,
  getItemDetail,
  getItemRow,
  updateItem,
  upsertSummary,
  upsertTranscript
} from "../db/repository.js";
import {
  chunkAudioForOpenAI,
  createTempWorkDir,
  downloadRemoteAudio,
  downloadYouTubeAudio,
  fetchYouTubeCaptions,
  readYouTubeMetadata,
  removeWorkDir,
  resolvePodcastAudioUrl
} from "./media.js";
import { cacheThumbnail } from "./thumbnail.js";
import { summarizeTranscript, transcribeAudioChunks } from "./ai.js";

export async function processItem(itemId: string): Promise<void> {
  const item = getItemRow(itemId);
  if (!item) throw new Error(`Item ${itemId} no longer exists.`);

  updateItem(itemId, { status: "processing", error: null });
  addLog(itemId, "info", "Processing started.");

  let transcript: { itemId: string; source: TranscriptSource; language: string | null; text: string; segments: TranscriptSegment[] };

  if (item.sourceType === "youtube") {
    transcript = await processYouTubeItem(itemId, item.url);
  } else {
    transcript = await processAudioOrPodcastItem(itemId, item.url);
  }

  if (!transcript.text.trim()) {
    throw new Error("No transcript text was produced.");
  }

  upsertTranscript(transcript);
  addLog(itemId, "info", "Transcript saved.");

  await summarizeStoredTranscript(itemId);
}

export async function summarizeStoredTranscript(itemId: string): Promise<void> {
  const detail = getItemDetail(itemId);
  if (!detail) throw new Error(`Item ${itemId} no longer exists.`);
  if (!detail.transcript?.text.trim()) {
    throw new Error("No transcript is saved for this item.");
  }

  updateItem(itemId, { status: "processing", error: null });
  const model = summaryModelId();
  addLog(itemId, "info", `Generating learning notes with ${model}.`);
  const notes = await summarizeTranscript({
    title: detail.title,
    creator: detail.creator,
    url: detail.canonicalUrl,
    transcript: detail.transcript.text
  });

  const renderedMarkdown = renderLearningNotesMarkdown({
    title: detail.title,
    creator: detail.creator,
    url: detail.url,
    canonicalUrl: detail.canonicalUrl,
    thumbnailMarkdownUrl: detail.thumbnailUrl,
    durationSeconds: detail.durationSeconds,
    sourceType: detail.sourceType,
    status: "complete",
    model,
    notes
  });

  upsertSummary({
    itemId,
    model,
    notes,
    renderedMarkdown
  });

  updateItem(itemId, { status: "complete", error: null });
  addLog(itemId, "info", "Learning notes complete.");
}

async function processYouTubeItem(itemId: string, url: string): Promise<{
  itemId: string;
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}> {
  addLog(itemId, "info", "Fetching YouTube metadata.");
  const { raw, metadata } = await readYouTubeMetadata(url);
  updateItem(itemId, {
    title: metadata.title,
    creator: metadata.creator,
    durationSeconds: metadata.durationSeconds,
    thumbnailUrl: metadata.thumbnailUrl,
    canonicalUrl: metadata.canonicalUrl ?? undefined
  });
  if (metadata.thumbnailUrl) {
    try {
      const cached = await cacheThumbnail(itemId, metadata.thumbnailUrl);
      if (cached) {
        updateItem(itemId, {
          thumbnailPath: cached.relativePath,
          thumbnailMimeType: cached.mimeType,
          thumbnailCachedAt: cached.cachedAt
        });
        addLog(itemId, "info", "Thumbnail cached locally.");
      }
    } catch (error) {
      addLog(itemId, "warn", `Thumbnail cache skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  addLog(itemId, "info", "Checking for captions.");
  const captions = await fetchYouTubeCaptions(raw);
  if (captions) {
    addLog(itemId, "info", "Using available YouTube captions.");
    return {
      itemId,
      source: "youtube_caption",
      language: captions.language,
      text: captions.text,
      segments: captions.segments
    };
  }

  addLog(itemId, "info", "No captions found. Falling back to audio transcription.");
  if (config.aiTranscribeProvider === "captions-only") {
    throw new Error("No YouTube captions were found and AI_TRANSCRIBE_PROVIDER=captions-only is enabled.");
  }
  return processAudioFallback(itemId, async (workDir) => downloadYouTubeAudio(url, workDir));
}

async function processAudioOrPodcastItem(itemId: string, url: string): Promise<{
  itemId: string;
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}> {
  if (config.aiTranscribeProvider === "captions-only") {
    throw new Error("AI_TRANSCRIBE_PROVIDER=captions-only cannot process podcast or audio-only links.");
  }

  addLog(itemId, "info", "Resolving audio URL.");
  const audioUrl = await resolvePodcastAudioUrl(url);
  return processAudioFallback(itemId, async (workDir) => {
    const download = await downloadRemoteAudio(audioUrl, workDir);
    if (download.title) {
      updateItem(itemId, { title: download.title });
    }
    return download.filePath;
  });
}

async function processAudioFallback(
  itemId: string,
  getAudioFile: (workDir: string) => Promise<string>
): Promise<{
  itemId: string;
  source: TranscriptSource;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
}> {
  const workDir = await createTempWorkDir();
  try {
    addLog(itemId, "info", "Preparing audio.");
    const audioPath = await getAudioFile(workDir);
    const chunks = await chunkAudioForOpenAI(audioPath, workDir);
    addLog(itemId, "info", `Transcribing ${chunks.length} audio chunk${chunks.length === 1 ? "" : "s"}.`);
    const text = await transcribeAudioChunks(chunks);
    const segments = textToApproximateSegments(text);
    return {
      itemId,
      source: "audio_transcription",
      language: null,
      text,
      segments
    };
  } finally {
    await removeWorkDir(workDir);
  }
}

function textToApproximateSegments(text: string): TranscriptSegment[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return text ? [{ start: 0, end: 0, text }] : [];
  }

  return paragraphs.map((paragraph, index) => ({
    start: index,
    end: index + 1,
    text: transcriptText([{ start: index, end: index + 1, text: paragraph }])
  }));
}
