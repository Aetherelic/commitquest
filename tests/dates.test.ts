import { describe, expect, it } from "vitest";
import { isQuestEligible } from "../src/core/dates.js";

describe("quest timestamp precision", () => {
  it("accepts activity made in the same whole second as campaign registration", () => {
    expect(isQuestEligible(
      "2026-07-15T21:56:24.000Z",
      "2026-07-15T21:56:24.842Z"
    )).toBe(true);
  });

  it("still rejects activity from an earlier second", () => {
    expect(isQuestEligible(
      "2026-07-15T21:56:23.999Z",
      "2026-07-15T21:56:24.000Z"
    )).toBe(false);
  });
});
