import { describe, expect, it } from "vitest";
import { buildFtsQuery } from "./search.js";
import { normalizeCaptureUrl } from "./url.js";

describe("normalizeCaptureUrl", () => {
  it("canonicalizes YouTube watch URLs for dedupe", () => {
    const first = normalizeCaptureUrl("https://www.youtube.com/watch?v=abc123&utm_source=x&feature=share");
    const second = normalizeCaptureUrl("https://youtu.be/abc123?si=whatever");

    expect(first.canonicalUrl).toBe("https://www.youtube.com/watch?v=abc123");
    expect(second.canonicalUrl).toBe(first.canonicalUrl);
    expect(first.sourceType).toBe("youtube");
  });

  it("keeps direct audio URLs as audio sources", () => {
    const normalized = normalizeCaptureUrl("https://example.com/show/episode-1.mp3?utm_campaign=test");

    expect(normalized.sourceType).toBe("audio");
    expect(normalized.canonicalUrl).toBe("https://example.com/show/episode-1.mp3");
  });
});

describe("buildFtsQuery", () => {
  it("turns a search phrase into a safe prefix query", () => {
    expect(buildFtsQuery('AI "agents" notes')).toBe('"ai"* AND "agents"* AND "notes"*');
  });
});
