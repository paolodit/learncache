import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const textProviderSchema = z.enum(["openai", "openrouter", "gemini"]);
export const transcribeProviderSchema = z.enum(["openai", "captions-only", "local-whisper"]);
export const youtubeTranscriptProviderSchema = z.enum(["auto", "yt-dlp", "supadata"]);
export const supadataTranscriptModeSchema = z.enum(["native", "generate", "auto"]);
export const authProviderSchema = z.enum(["none", "password", "clerk"]);

export const envSchema = z.object({
  APP_PUBLIC_URL: z.string().default("http://127.0.0.1:3000"),
  AI_TEXT_PROVIDER: textProviderSchema.default("openai"),
  AI_TRANSCRIBE_PROVIDER: transcribeProviderSchema.default("openai"),
  YOUTUBE_TRANSCRIPT_PROVIDER: youtubeTranscriptProviderSchema.default("auto"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_SUMMARY_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_TEXT_MODEL: z.string().default("openrouter/free"),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_TEXT_MODEL: z.string().default("gemini-3.5-flash"),
  SUPADATA_API_KEY: z.string().default(""),
  SUPADATA_TRANSCRIPT_MODE: supadataTranscriptModeSchema.default("native"),
  SUPADATA_LANG: z.string().default("en"),
  YTDLP_COOKIES_PATH: z.string().default(""),
  LOCAL_WHISPER_COMMAND: z.string().default("whisper"),
  LOCAL_WHISPER_MODEL: z.string().default("base"),
  LOCAL_WHISPER_EXTRA_ARGS: z.string().default(""),
  DATA_DIR: z.string().default("./data"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4311),
  WORKER_DISABLED: z.string().optional(),
  AUTH_ENABLED: z.string().default("false"),
  AUTH_PROVIDER: authProviderSchema.optional(),
  APP_PASSWORD: z.string().default(""),
  APP_SESSION_SECRET: z.string().default(""),
  EXTENSION_API_TOKEN: z.string().default(""),
  CLERK_PUBLISHABLE_KEY: z.string().default(""),
  CLERK_SECRET_KEY: z.string().default(""),
  ALLOWED_EMAILS: z.string().default(""),
  CORS_ALLOWED_ORIGINS: z.string().default("")
});

const parsed = envSchema.parse(process.env);
const authEnabled = isTruthy(parsed.AUTH_ENABLED);
const authProvider = parsed.AUTH_PROVIDER ?? (authEnabled ? "password" : "none");

export const config = {
  appPublicUrl: parsed.APP_PUBLIC_URL,
  aiTextProvider: parsed.AI_TEXT_PROVIDER,
  aiTranscribeProvider: parsed.AI_TRANSCRIBE_PROVIDER,
  youtubeTranscriptProvider: parsed.YOUTUBE_TRANSCRIPT_PROVIDER,
  openaiApiKey: parsed.OPENAI_API_KEY,
  openaiSummaryModel: parsed.OPENAI_SUMMARY_MODEL,
  openaiTranscribeModel: parsed.OPENAI_TRANSCRIBE_MODEL,
  openRouterApiKey: parsed.OPENROUTER_API_KEY,
  openRouterTextModel: parsed.OPENROUTER_TEXT_MODEL,
  geminiApiKey: parsed.GEMINI_API_KEY,
  geminiTextModel: parsed.GEMINI_TEXT_MODEL,
  supadataApiKey: parsed.SUPADATA_API_KEY,
  supadataTranscriptMode: parsed.SUPADATA_TRANSCRIPT_MODE,
  supadataLang: parsed.SUPADATA_LANG,
  ytdlpCookiesPath: parsed.YTDLP_COOKIES_PATH,
  localWhisperCommand: parsed.LOCAL_WHISPER_COMMAND,
  localWhisperModel: parsed.LOCAL_WHISPER_MODEL,
  localWhisperExtraArgs: splitShellishArgs(parsed.LOCAL_WHISPER_EXTRA_ARGS),
  dataDir: path.resolve(process.cwd(), parsed.DATA_DIR),
  apiHost: parsed.API_HOST,
  apiPort: parsed.API_PORT,
  workerDisabled: parsed.WORKER_DISABLED === "1" || parsed.WORKER_DISABLED === "true",
  authEnabled,
  authProvider,
  appPassword: parsed.APP_PASSWORD,
  appSessionSecret: parsed.APP_SESSION_SECRET,
  extensionApiToken: parsed.EXTENSION_API_TOKEN,
  clerkPublishableKey: parsed.CLERK_PUBLISHABLE_KEY,
  clerkSecretKey: parsed.CLERK_SECRET_KEY,
  allowedEmails: splitCsv(parsed.ALLOWED_EMAILS).map((email) => email.toLowerCase()),
  corsAllowedOrigins: splitCsv(parsed.CORS_ALLOWED_ORIGINS)
};

export function requireOpenAiKey(): string {
  if (!config.openaiApiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env before transcription or summarization.");
  }

  return config.openaiApiKey;
}

export function requireOpenRouterKey(): string {
  if (!config.openRouterApiKey.trim()) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to .env or choose another AI_TEXT_PROVIDER.");
  }

  return config.openRouterApiKey;
}

export function requireGeminiKey(): string {
  if (!config.geminiApiKey.trim()) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env or choose another AI_TEXT_PROVIDER.");
  }

  return config.geminiApiKey;
}

export function requireSupadataKey(): string {
  if (!config.supadataApiKey.trim()) {
    throw new Error("SUPADATA_API_KEY is missing. Add it to .env or set YOUTUBE_TRANSCRIPT_PROVIDER=yt-dlp.");
  }

  return config.supadataApiKey;
}

export function summaryModelId(): string {
  if (config.aiTextProvider === "openrouter") return `${config.aiTextProvider}:${config.openRouterTextModel}`;
  if (config.aiTextProvider === "gemini") return `${config.aiTextProvider}:${config.geminiTextModel}`;
  return `${config.aiTextProvider}:${config.openaiSummaryModel}`;
}

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitShellishArgs(value: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of value.matchAll(pattern)) {
    args.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return args.filter(Boolean);
}
