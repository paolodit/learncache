import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type { LearningNotes } from "../../shared/types.js";
import { config, requireGeminiKey, requireOpenAiKey, requireOpenRouterKey } from "../config.js";
import { learningNotesJsonSchema, learningNotesZodSchema } from "../lib/summary-schema.js";
import { runCommand } from "./command.js";

export async function transcribeAudioChunks(chunks: string[]): Promise<string> {
  if (config.aiTranscribeProvider === "captions-only") {
    throw new Error("AI_TRANSCRIBE_PROVIDER=captions-only cannot transcribe audio. Use captioned YouTube videos or choose openai/local-whisper.");
  }

  if (config.aiTranscribeProvider === "local-whisper") {
    return transcribeWithLocalWhisper(chunks);
  }

  return transcribeWithOpenAI(chunks);
}

export async function summarizeTranscript(input: {
  title: string | null;
  creator: string | null;
  url: string;
  transcript: string;
}): Promise<LearningNotes> {
  if (config.aiTextProvider === "openrouter") return summarizeWithOpenRouter(input);
  if (config.aiTextProvider === "gemini") return summarizeWithGemini(input);
  return summarizeWithOpenAI(input);
}

async function transcribeWithOpenAI(chunks: string[]): Promise<string> {
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

async function transcribeWithLocalWhisper(chunks: string[]): Promise<string> {
  const parts: string[] = [];

  for (const chunk of chunks) {
    const outputDir = path.join(path.dirname(chunk), `whisper-${path.basename(chunk, path.extname(chunk))}`);
    await fsp.mkdir(outputDir, { recursive: true });
    await runCommand(config.localWhisperCommand, [
      chunk,
      "--model",
      config.localWhisperModel,
      "--output_format",
      "txt",
      "--output_dir",
      outputDir,
      ...config.localWhisperExtraArgs
    ]);

    const expected = path.join(outputDir, `${path.basename(chunk, path.extname(chunk))}.txt`);
    const candidates = await fsp.readdir(outputDir);
    const transcriptPath = (await fileExists(expected)) ? expected : path.join(outputDir, candidates.find((file) => file.endsWith(".txt")) ?? "");
    if (!transcriptPath || !(await fileExists(transcriptPath))) {
      throw new Error("Local Whisper completed but did not produce a .txt transcript.");
    }
    parts.push((await fsp.readFile(transcriptPath, "utf8")).trim());
  }

  return parts.filter(Boolean).join("\n").trim();
}

async function summarizeWithOpenAI(input: {
  title: string | null;
  creator: string | null;
  url: string;
  transcript: string;
}): Promise<LearningNotes> {
  const apiKey = requireOpenAiKey();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiSummaryModel,
      instructions: systemPrompt(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: learningPrompt(input)
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
  if (!rawText) throw new Error("OpenAI summary response did not include output text.");
  return parseLearningNotes(rawText, "OpenAI");
}

async function summarizeWithOpenRouter(input: {
  title: string | null;
  creator: string | null;
  url: string;
  transcript: string;
}): Promise<LearningNotes> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenRouterKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.appPublicUrl,
      "X-OpenRouter-Title": "LearnCache"
    },
    body: JSON.stringify({
      model: config.openRouterTextModel,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: `${learningPrompt(input)}\n\nReturn only JSON matching this schema:\n${JSON.stringify(learningNotesJsonSchema)}` }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter summary request failed with HTTP ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const rawText = payload.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("OpenRouter summary response did not include message content.");
  return parseLearningNotes(rawText, "OpenRouter");
}

async function summarizeWithGemini(input: {
  title: string | null;
  creator: string | null;
  url: string;
  transcript: string;
}): Promise<LearningNotes> {
  const model = encodeURIComponent(config.geminiTextModel);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(requireGeminiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt() }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `${learningPrompt(input)}\n\nReturn only JSON matching this schema:\n${JSON.stringify(learningNotesJsonSchema)}` }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini summary request failed with HTTP ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!rawText) throw new Error("Gemini summary response did not include text.");
  return parseLearningNotes(rawText, "Gemini");
}

function learningPrompt(input: { title: string | null; creator: string | null; url: string; transcript: string }): string {
  return [
    `Title: ${input.title ?? "Untitled"}`,
    `Creator: ${input.creator ?? "Unknown"}`,
    `URL: ${input.url}`,
    "",
    "Create learning notes with a short TL;DR, 5-10 key ideas, a useful timestamped outline when timestamps are present, notable claims, 3-8 tags, and follow-up questions.",
    "",
    limitTranscript(input.transcript)
  ].join("\n");
}

function systemPrompt(): string {
  return "You turn transcripts into concise private learning notes. Preserve uncertainty, avoid invented details, and use timestamps only when they are supported by the transcript.";
}

function parseLearningNotes(rawText: string, providerName: string): LearningNotes {
  const parsed = JSON.parse(extractJsonObject(rawText)) as unknown;
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

function extractJsonObject(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  throw new Error("Summary response did not contain a JSON object.");
}

function limitTranscript(transcript: string): string {
  const maxChars = 240_000;
  if (transcript.length <= maxChars) return transcript;
  return `${transcript.slice(0, maxChars)}\n\n[Transcript truncated for summary generation.]`;
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 12);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}
