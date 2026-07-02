import { describe, expect, it } from "vitest";
import { isEmailAllowed, signSession, verifySession } from "./auth.js";

describe("isEmailAllowed", () => {
  it("matches allowlisted emails case-insensitively", () => {
    expect(isEmailAllowed("ME@EXAMPLE.COM", ["me@example.com"])).toBe(true);
  });

  it("rejects missing or unlisted emails", () => {
    expect(isEmailAllowed(null, ["me@example.com"])).toBe(false);
    expect(isEmailAllowed("other@example.com", ["me@example.com"])).toBe(false);
  });

  it("round-trips signed password sessions", () => {
    const token = signSession({ sub: "owner", exp: Math.floor(Date.now() / 1000) + 60 });
    expect(verifySession(token)?.sub).toBe("owner");
  });

  it("rejects expired password sessions", () => {
    const token = signSession({ sub: "owner", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(verifySession(token)).toBeNull();
  });
});
