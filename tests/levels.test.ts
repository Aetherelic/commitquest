import { describe, expect, it } from "vitest";
import { calculateLevel, titleForLevel, xpThresholdForLevel } from "../src/core/levels.js";

describe("level progression", () => {
  it("uses increasing level thresholds", () => {
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(275);
    expect(xpThresholdForLevel(5)).toBe(850);
  });

  it("returns progress inside the current level", () => {
    expect(calculateLevel(99).level).toBe(1);
    const progress = calculateLevel(375);
    expect(progress.level).toBe(3);
    expect(progress.xpIntoLevel).toBe(100);
    expect(progress.title).toBe("Code Explorer");
  });

  it("assigns milestone titles", () => {
    expect(titleForLevel(5)).toBe("Repository Ranger");
    expect(titleForLevel(30)).toBe("Git Legend");
  });
});
