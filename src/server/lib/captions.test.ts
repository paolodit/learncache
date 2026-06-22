import { describe, expect, it } from "vitest";
import { parseCaptionText, parseTimestamp, transcriptText } from "./captions.js";

describe("caption parsing", () => {
  it("parses VTT segments", () => {
    const segments = parseCaptionText(`WEBVTT

00:00:01.000 --> 00:00:03.500
Hello <b>there</b>

00:00:03.500 --> 00:00:05.000
General Kenobi`);

    expect(segments).toEqual([
      { start: 1, end: 3.5, text: "Hello there" },
      { start: 3.5, end: 5, text: "General Kenobi" }
    ]);
    expect(transcriptText(segments)).toBe("Hello there\nGeneral Kenobi");
  });

  it("parses SRT timestamps", () => {
    expect(parseTimestamp("01:02:03,400")).toBe(3723.4);
  });
});
