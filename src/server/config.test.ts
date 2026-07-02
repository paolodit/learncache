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
  });

  it("rejects unsupported provider modes", () => {
    expect(() =>
      envSchema.parse({
        AI_TEXT_PROVIDER: "free-magic"
      })
    ).toThrow();
  });
});
