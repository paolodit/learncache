import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "./auth.js";

describe("isEmailAllowed", () => {
  it("matches allowlisted emails case-insensitively", () => {
    expect(isEmailAllowed("ME@EXAMPLE.COM", ["me@example.com"])).toBe(true);
  });

  it("rejects missing or unlisted emails", () => {
    expect(isEmailAllowed(null, ["me@example.com"])).toBe(false);
    expect(isEmailAllowed("other@example.com", ["me@example.com"])).toBe(false);
  });
});
