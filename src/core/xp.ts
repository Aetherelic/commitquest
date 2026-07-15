import type { CommitType } from "./types.js";

const BASE_XP: Record<CommitType, number> = {
  feat: 40,
  fix: 30,
  docs: 15,
  test: 25,
  refactor: 25,
  perf: 30,
  build: 15,
  ci: 15,
  chore: 10,
  style: 10,
  revert: 15,
  merge: 10,
  commit: 20
};

const CONVENTIONAL_PATTERN = /^(feat|fix|docs|test|refactor|perf|build|ci|chore|style|revert)(?:\([^)]+\))?(!)?:\s+/i;

export function classifyCommit(subject: string): { type: CommitType; breaking: boolean } {
  if (/^merge\b/i.test(subject)) {
    return { type: "merge", breaking: false };
  }

  const match = subject.match(CONVENTIONAL_PATTERN);
  if (!match) {
    return { type: "commit", breaking: false };
  }

  return {
    type: match[1]!.toLowerCase() as CommitType,
    breaking: Boolean(match[2])
  };
}

export function calculateBaseXp(type: CommitType, filesChanged: number, breaking = false): number {
  let sizeBonus = 0;
  if (filesChanged >= 10) sizeBonus = 15;
  else if (filesChanged >= 5) sizeBonus = 10;
  else if (filesChanged >= 2) sizeBonus = 5;

  return BASE_XP[type] + sizeBonus + (breaking ? 20 : 0);
}

export function diminishingMultiplier(existingCommitsToday: number): number {
  if (existingCommitsToday < 5) return 1;
  if (existingCommitsToday < 10) return 0.5;
  return 0.25;
}

export function calculateAwardedXp(
  baseXp: number,
  existingCommitsToday: number,
  xpAlreadyAwardedToday: number,
  dailyCap = 250
): number {
  const remaining = Math.max(0, dailyCap - xpAlreadyAwardedToday);
  const diminished = Math.round(baseXp * diminishingMultiplier(existingCommitsToday));
  return Math.min(remaining, diminished);
}
