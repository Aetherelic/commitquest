import { describe, expect, it } from "vitest";
import { calculateAwardedXp, calculateBaseXp, classifyCommit, diminishingMultiplier } from "../src/core/xp.js";

describe("XP engine", () => {
  it("classifies conventional commits", () => {
    expect(classifyCommit("feat(cli): add quest board")).toEqual({ type: "feat", breaking: false });
    expect(classifyCommit("fix!: replace database format")).toEqual({ type: "fix", breaking: true });
    expect(classifyCommit("ordinary update")).toEqual({ type: "commit", breaking: false });
  });

  it("adds restrained bonuses without using line count", () => {
    expect(calculateBaseXp("feat", 1)).toBe(40);
    expect(calculateBaseXp("feat", 5)).toBe(50);
    expect(calculateBaseXp("feat", 10, true)).toBe(75);
  });

  it("diminishes repeated daily rewards and respects the cap", () => {
    expect(diminishingMultiplier(0)).toBe(1);
    expect(diminishingMultiplier(5)).toBe(0.5);
    expect(diminishingMultiplier(10)).toBe(0.25);
    expect(calculateAwardedXp(40, 0, 240)).toBe(10);
    expect(calculateAwardedXp(40, 10, 250)).toBe(0);
  });
});
