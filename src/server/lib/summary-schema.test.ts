import { describe, expect, it } from "vitest";
import { learningNotesZodSchema } from "./summary-schema.js";

describe("learning notes schema", () => {
  it("accepts the expected structured output", () => {
    const parsed = learningNotesZodSchema.parse({
      tldr: "Short summary",
      keyIdeas: ["One"],
      timestampedOutline: [{ timestamp: null, label: "Intro", summary: "Starts here" }],
      notableClaims: [{ timestamp: 10, claim: "Claim", support: "Because" }],
      tags: ["learning"],
      followUpQuestions: ["Question?"]
    });

    expect(parsed.tldr).toBe("Short summary");
  });
});
