import { describe, expect, it } from "vitest";
import { calculateStreak } from "../src/core/streak.js";

describe("streaks", () => {
  it("calculates current and longest streaks", () => {
    const result = calculateStreak(
      [
        "2026-07-01T12:00:00Z",
        "2026-07-02T12:00:00Z",
        "2026-07-04T12:00:00Z",
        "2026-07-05T12:00:00Z",
        "2026-07-06T12:00:00Z"
      ],
      new Date("2026-07-06T20:00:00Z")
    );
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it("allows the active streak to end yesterday", () => {
    const result = calculateStreak(
      ["2026-07-04T12:00:00Z", "2026-07-05T12:00:00Z"],
      new Date("2026-07-06T12:00:00Z")
    );
    expect(result.current).toBe(2);
  });
});
