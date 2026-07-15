import { describe, expect, it } from "vitest";
import { initialTuiState } from "../src/tui/navigation.js";
import {
  FOOTER_CREDIT,
  renderTui,
  stripAnsi,
  TUI_MINIMUM_SIZE
} from "../src/tui/render.js";
import type { TuiModel, TuiScreen } from "../src/tui/types.js";

function populatedModel(): TuiModel {
  return {
    profile: { name: "Aetherelic", email: "developer@example.com" },
    level: {
      level: 4,
      title: "Code Explorer",
      currentLevelXp: 525,
      nextLevelXp: 850,
      xpIntoLevel: 145,
      xpNeeded: 325,
      percentage: 45
    },
    totalXp: 670,
    streak: { current: 3, longest: 8 },
    stats: { commits: 21, repositories: 2, releases: 1, questRewards: 5, achievements: 3 },
    quests: [{
      key: "weekly",
      title: "Build Momentum",
      description: "Make five commits this week.",
      progress: 4,
      target: 5,
      rewardXp: 80,
      complete: false,
      periodLabel: "Weekly"
    }],
    rewardedQuestKeys: new Set(),
    customQuests: [{
      id: 1,
      title: "Ship CommitQuest v0.2",
      repositoryId: 1,
      repositoryName: "commitquest",
      objectiveType: "release",
      target: 1,
      rewardXp: 250,
      baselineCount: 0,
      createdAt: "2026-07-16T10:00:00.000Z",
      deadlineAt: null,
      completedAt: null,
      abandonedAt: null,
      progress: 0,
      complete: false,
      status: "active",
      description: "Create 1 tagged release in commitquest."
    }],
    achievements: [
      {
        key: "first",
        title: "The Quest Begins",
        description: "Import your first commit.",
        rewardXp: 50,
        unlocked: true,
        unlockedAt: "2026-07-16T10:00:00.000Z"
      },
      {
        key: "ship",
        title: "Ship It",
        description: "Create your first tagged release.",
        rewardXp: 150,
        unlocked: false,
        unlockedAt: null
      }
    ],
    campaigns: [{
      id: 1,
      name: "commitquest",
      path: "/home/aether/Projects/commitquest",
      defaultBranch: "main",
      addedAt: "2026-07-16T10:00:00.000Z",
      lastScannedAt: "2026-07-16T12:00:00.000Z",
      commits: 6,
      releases: 0,
      earnedXp: 390,
      lastActivityAt: "2026-07-16T11:50:00.000Z"
    }],
    recentActivity: [{
      kind: "commit",
      repositoryName: "commitquest",
      occurredAt: "2026-07-16T11:50:00.000Z",
      subject: "feat: add interactive dashboard",
      type: "feat",
      awardedXp: 55,
      reference: "abcdef1234567890"
    }],
    commitTypes: [
      { type: "feat", count: 8, xp: 320 },
      { type: "fix", count: 5, xp: 140 },
      { type: "docs", count: 3, xp: 70 }
    ],
    dailyXp: [
      { date: "2026-07-16", xp: 220 },
      { date: "2026-07-15", xp: 180 }
    ],
    notice: "Journey refreshed · 1 new commit · 0 new releases · +55 activity XP",
    warnings: [],
    refreshedAt: "2026-07-16T12:00:00.000Z"
  };
}

describe("interactive dashboard rendering", () => {
  it("renders every screen within the requested terminal bounds", () => {
    const model = populatedModel();
    const screens: TuiScreen[] = ["home", "quests", "campaigns", "achievements", "progress", "log"];

    for (const screen of screens) {
      const state = { ...initialTuiState(), screen };
      const output = stripAnsi(renderTui(model, state, { width: 110, height: 32 }, { color: false }));
      const lines = output.split("\n");
      expect(lines).toHaveLength(32);
      expect(lines.every((line) => line.length === 110)).toBe(true);
      expect(output).toContain("COMMITQUEST");
      expect(output).toContain(FOOTER_CREDIT);
    }
  });

  it("shows quests, achievements, and the game credit", () => {
    const model = populatedModel();
    const questOutput = renderTui(
      model,
      { ...initialTuiState(), screen: "quests" },
      { width: 100, height: 28 },
      { color: false }
    );
    expect(questOutput).toContain("Ship CommitQuest v0.2");
    expect(questOutput).toContain("+250 XP");

    const achievementOutput = renderTui(
      model,
      { ...initialTuiState(), screen: "achievements" },
      { width: 100, height: 28 },
      { color: false }
    );
    expect(achievementOutput).toContain("BADGE UNLOCKED");
    expect(achievementOutput).toContain("Ship It");
    expect(achievementOutput).toContain("Made with <3 by Aetherelic");
  });

  it("shows a safe resize message in undersized terminals", () => {
    const output = renderTui(
      populatedModel(),
      initialTuiState(),
      { width: 50, height: 12 },
      { color: false }
    );
    expect(output).toContain("Terminal too small");
    expect(output).toContain(`${TUI_MINIMUM_SIZE.width}×${TUI_MINIMUM_SIZE.height}`);
    expect(output).toContain(FOOTER_CREDIT);
  });
});
