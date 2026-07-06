import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { SetupStatus } from "../../shared/types.js";
import { config } from "../config.js";
import { resolveCommand } from "../services/command.js";

export async function registerSetupRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/setup/status", async (): Promise<SetupStatus> => ({
    appPublicUrl: config.appPublicUrl,
    dataDir: {
      path: config.dataDir,
      writable: isWritableDirectory(config.dataDir)
    },
    auth: {
      enabled: config.authEnabled,
      provider: config.authProvider,
      appPasswordConfigured: Boolean(config.appPassword.trim()),
      sessionSecretConfigured: Boolean(config.appSessionSecret.trim()),
      extensionTokenConfigured: Boolean(config.extensionApiToken.trim())
    },
    cors: {
      allowedOrigins: config.corsAllowedOrigins,
      chromeExtensionWildcard: config.corsAllowedOrigins.includes("chrome-extension://*")
    },
    ai: {
      textProvider: config.aiTextProvider,
      textProviderConfigured: textProviderConfigured(),
      transcribeProvider: config.aiTranscribeProvider,
      transcribeProviderConfigured: transcribeProviderConfigured(),
      supadataConfigured: Boolean(config.supadataApiKey.trim()),
      youtubeTranscriptProvider: config.youtubeTranscriptProvider
    },
    tools: {
      ytdlpAvailable: commandAvailable("yt-dlp"),
      ffmpegAvailable: commandAvailable("ffmpeg")
    },
    extensionConfigTemplate: {
      appUrl: config.appPublicUrl,
      extensionApiToken: "paste EXTENSION_API_TOKEN here",
      hostPermissions: extensionHostPermissions(config.appPublicUrl)
    }
  }));
}

function textProviderConfigured(): boolean {
  if (config.aiTextProvider === "openai") return Boolean(config.openaiApiKey.trim());
  if (config.aiTextProvider === "openrouter") return Boolean(config.openRouterApiKey.trim());
  if (config.aiTextProvider === "gemini") return Boolean(config.geminiApiKey.trim());
  return false;
}

function transcribeProviderConfigured(): boolean {
  if (config.aiTranscribeProvider === "captions-only") return true;
  if (config.aiTranscribeProvider === "local-whisper") return commandAvailable(config.localWhisperCommand);
  return Boolean(config.openaiApiKey.trim());
}

function isWritableDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.accessSync(directory, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function commandAvailable(command: string): boolean {
  const resolved = resolveCommand(command);
  if (path.isAbsolute(resolved) && !fs.existsSync(resolved)) return false;

  const result = spawnSync(resolved, ["--version"], {
    windowsHide: true,
    timeout: 3000,
    stdio: "ignore"
  });
  return result.status === 0;
}

function extensionHostPermissions(appPublicUrl: string): string[] {
  const origins = ["https://www.youtube.com/*"];
  try {
    const origin = new URL(appPublicUrl).origin.replace(/\/$/, "");
    origins.push(`${origin}/*`);
  } catch {
    origins.push("https://learncache.example.com/*");
  }
  return origins;
}
