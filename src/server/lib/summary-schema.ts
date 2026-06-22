import { z } from "zod";

export const learningNotesZodSchema = z.object({
  tldr: z.string().min(1),
  keyIdeas: z.array(z.string().min(1)).default([]),
  timestampedOutline: z
    .array(
      z.object({
        timestamp: z.number().nullable(),
        label: z.string().min(1),
        summary: z.string().min(1)
      })
    )
    .default([]),
  notableClaims: z
    .array(
      z.object({
        timestamp: z.number().nullable(),
        claim: z.string().min(1),
        support: z.string().min(1)
      })
    )
    .default([]),
  tags: z.array(z.string().min(1)).default([]),
  followUpQuestions: z.array(z.string().min(1)).default([])
});

export const learningNotesJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tldr: { type: "string" },
    keyIdeas: { type: "array", items: { type: "string" } },
    timestampedOutline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          timestamp: { type: ["number", "null"] },
          label: { type: "string" },
          summary: { type: "string" }
        },
        required: ["timestamp", "label", "summary"]
      }
    },
    notableClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          timestamp: { type: ["number", "null"] },
          claim: { type: "string" },
          support: { type: "string" }
        },
        required: ["timestamp", "claim", "support"]
      }
    },
    tags: { type: "array", items: { type: "string" } },
    followUpQuestions: { type: "array", items: { type: "string" } }
  },
  required: ["tldr", "keyIdeas", "timestampedOutline", "notableClaims", "tags", "followUpQuestions"]
} as const;
