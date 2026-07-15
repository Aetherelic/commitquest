export interface LevelProgress {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeeded: number;
  percentage: number;
}

const TITLES: Array<[number, string]> = [
  [30, "Git Legend"],
  [20, "Systems Architect"],
  [16, "Release Vanguard"],
  [12, "Systems Adventurer"],
  [8, "Branch Warden"],
  [5, "Repository Ranger"],
  [3, "Code Explorer"],
  [1, "Script Novice"]
];

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  const completedLevels = level - 1;
  return completedLevels * 100 + (75 * completedLevels * (completedLevels - 1)) / 2;
}

export function titleForLevel(level: number): string {
  return TITLES.find(([minimum]) => level >= minimum)?.[1] ?? "Script Novice";
}

export function calculateLevel(totalXp: number): LevelProgress {
  let level = 1;
  while (xpThresholdForLevel(level + 1) <= totalXp) {
    level += 1;
  }

  const currentLevelXp = xpThresholdForLevel(level);
  const nextLevelXp = xpThresholdForLevel(level + 1);
  const xpIntoLevel = totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;

  return {
    level,
    title: titleForLevel(level),
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeeded,
    percentage: xpNeeded === 0 ? 100 : Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  };
}
