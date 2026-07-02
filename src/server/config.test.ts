import { describe, expect, it } from "vitest";
import { envSchema } from "./config.js";

describe("envSchema", () => {
  it("accepts supported provider modes", () => {
    const parsed = envSchema.parse({
      AI_TEXT_PROVIDER: "openrouter",
      AI_TRANSCRIBE_PROVIDER: "captions-only"
    });

    expect(parsed.AI_TEXT_PROVIDER).toBe("openrouter");
    expect(parsed.AI_TRANSCRIBE_PROVIDER).toBe("captions-only");
    expect(parsed.YOUTUBE_TRANSCRIPT_PROVIDER).toBe("auto");
    expect(parsed.OPENROUTER_TEXT_MODEL).toBe("openrouter/free");
    expect(parsed.SUPADATA_TRANSCRIPT_MODE).toBe("native");
    expect(parsed.YTDLP_COOKIES_PATH).toBe("");
    expect(parsed.AUTH_PROVIDER).toBeUndefined();
  });

  it("accepts password auth provider settings", () => {
    const parsed = envSchema.parse({
      AUTH_ENABLED: "true",
      AUTH_PROVIDER: "password",
      APP_PASSWORD: "secret",
      APP_SESSION_SECRET: "session-secret",
      EXTENSION_API_TOKEN: "extension-token"
    });

    expect(parsed.AUTH_PROVIDER).toBe("password");
    expect(parsed.APP_PASSWORD).toBe("secret");
    expect(parsed.APP_SESSION_SECRET).toBe("session-secret");
    expect(parsed.EXTENSION_API_TOKEN).toBe("extension-token");
  });

  it("rejects unsupported provider modes", () => {
    expect(() =>
      envSchema.parse({
        AI_TEXT_PROVIDER: "free-magic"
      })
    ).toThrow();
  });
});
