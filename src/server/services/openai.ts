import fs from "node:fs";
import OpenAI from "openai";
import type { LearningNotes } from "../../shared/types.js";
import { config, requireOpenAiKey } from "../config.js";
import { learningNotesJsonSchema, learningNotesZodSchema } from "../lib/summary-schema.js";

export async function transcribeAudioChunks(chunks: string[]): Promise<string> {
  const openai = new OpenAI({ apiKey: requireOpenAiKey() });
  const parts: string[] = [];

  for (const chunk of chunks) {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(chunk),
      model: config.openaiTranscribeModel,
      response_format: "json"
    });
    parts.push(extractTranscriptionText(transcription));
  }

  return parts.join("\n").trim();
}

export async function summarizeTranscript(input: {
  title: string | null;
  creator: string | null;
  url: string;
  transcript: string;
}): Promise<LearningNotes> {
  const apiKey = requireOpenAiKey();
  const transcript = limitTranscript(input.transcript);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiSummaryModel,
      instructions:
        "You turn transcripts into concise private learning notes. Preserve uncertainty, avoid invented details, and use timestamps only when they are supported by the transcript.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Title: ${input.title ?? "Untitled"}`,
                `Creator: ${input.creator ?? "Unknown"}`,
                `URL: ${input.url}`,
                "",
                "Create learning notes with a short TL;DR, 5-10 key ideas, a useful timestamped outline when timestamps are present, notable claims, 3-8 tags, and follow-up questions.",
                "",
                transcript
              ].join("\n")
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "learning_notes",
          strict: true,
          schema: learningNotesJsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI summary request failed with HTTP ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as { output_text?: string; output?: unknown };
  const rawText = payload.output_text ?? extractResponsesText(payload.output);
  if (!rawText) {
    throw new Error("OpenAI summary response did not include output text.");
  }

  const parsed = JSON.parse(rawText) as unknown;
  const notes = learningNotesZodSchema.parse(parsed);
  return {
    ...notes,
    tags: normalizeTags(notes.tags)
  };
}

function extractTranscriptionText(response: unknown): string {
  if (typeof response === "string") return response;
  if (response && typeof response === "object" && "text" in response) {
    const text = (response as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  throw new Error("Transcription response did not include text.");
}

function extractResponsesText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("").trim() || null;
}

function limitTranscript(transcript: string): string {
  const maxChars = 240_000;
  if (transcript.length <= maxChars) return transcript;
  return `${transcript.slice(0, maxChars)}\n\n[Transcript truncated for summary generation.]`;
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}
