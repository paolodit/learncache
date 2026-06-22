import { describe, expect, it } from "vitest";
import { decideRetry } from "./jobs.js";

describe("decideRetry", () => {
  it("backs off before the final attempt", () => {
    const decision = decideRetry(0, 1000);

    expect(decision.final).toBe(false);
    expect(decision.attempts).toBe(1);
    expect(decision.retryAt).toBe(31_000);
  });

  it("stops after the max attempts", () => {
    const decision = decideRetry(2, 1000);

    expect(decision.final).toBe(true);
    expect(decision.retryAt).toBeNull();
  });
});
