import { describe, expect, it } from "vitest";
import { createZip } from "./zip.js";

describe("createZip", () => {
  it("creates a portable notes bundle", () => {
    const zip = createZip([
      { name: "notes.md", data: Buffer.from("# Notes\n") },
      { name: "assets/thumbnail.jpg", data: Buffer.from([1, 2, 3]) }
    ]);

    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from("notes.md"))).toBe(true);
    expect(zip.includes(Buffer.from("assets/thumbnail.jpg"))).toBe(true);
    expect(zip.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });
});
