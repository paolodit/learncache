import { describe, expect, it } from "vitest";
import { itemExportJson, renderLearningNotesMarkdown } from "./markdown.js";
import type { ItemDetail } from "../../shared/types.js";

describe("renderLearningNotesMarkdown", () => {
  it("renders a portable note", () => {
    const markdown = renderLearningNotesMarkdown({
      title: "A Useful Talk",
      creator: "Someone",
      url: "https://example.com/talk",
      canonicalUrl: "https://example.com/canonical-talk",
      durationSeconds: 125,
      thumbnailMarkdownUrl: "assets/thumbnail.jpg",
      sourceType: "youtube",
      status: "complete",
      model: "openai:gpt-5.4-mini",
      notes: {
        tldr: "A concise summary.",
        keyIdeas: ["First idea"],
        timestampedOutline: [{ timestamp: 62, label: "Setup", summary: "Frames the problem." }],
        notableClaims: [{ timestamp: null, claim: "Important claim", support: "Explained in the transcript" }],
        tags: ["AI Notes"],
        followUpQuestions: ["What should I try next?"]
      }
    });

    expect(markdown).toContain("# A Useful Talk");
    expect(markdown).toContain("![Thumbnail](assets/thumbnail.jpg)");
    expect(markdown).toContain("- Duration: 2:05");
    expect(markdown).toContain("- Notes model: openai:gpt-5.4-mini");
    expect(markdown).toContain("[1:02] Setup");
    expect(markdown).toContain("#ai-notes");
  });

  it("exports source and thumbnail metadata as JSON", () => {
    const item = sampleItem();
    const exported = itemExportJson(item);

    expect(exported).toMatchObject({
      id: "item-1",
      thumbnailUrl: "https://img.example.com/thumb.jpg",
      thumbnailPath: "thumbnails/item-1.jpg",
      thumbnailMimeType: "image/jpeg",
      source: {
        originalUrl: "https://youtu.be/video",
        canonicalUrl: "https://www.youtube.com/watch?v=video",
        sourceType: "youtube"
      }
    });
  });
});

function sampleItem(): ItemDetail {
  return {
    id: "item-1",
    url: "https://youtu.be/video",
    canonicalUrl: "https://www.youtube.com/watch?v=video",
    sourceType: "youtube",
    title: "A Useful Talk",
    creator: "Someone",
    durationSeconds: 125,
    thumbnailUrl: "https://img.example.com/thumb.jpg",
    thumbnailPath: "thumbnails/item-1.jpg",
    thumbnailMimeType: "image/jpeg",
    thumbnailCachedAt: 123,
    status: "complete",
    error: null,
    createdAt: 1,
    updatedAt: 2,
    tags: ["ai-notes"],
    transcript: null,
    summary: null,
    logs: []
  };
}
