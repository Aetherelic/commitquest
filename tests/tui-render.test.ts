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
      archived: false,
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
    chapters: [{
      id: 1,
      repositoryId: 1,
      repositoryName: "commitquest",
      key: "foundation",
      title: "The First Quest",
      description: "Begin the campaign with a rewarded commit.",
      position: 1,
      objectiveType: "commit",
      target: 1,
      rewardXp: 50,
      baselineCount: 0,
      createdAt: "2026-07-16T10:00:00.000Z",
      completedAt: "2026-07-16T11:00:00.000Z",
      progress: 1,
      status: "complete"
    }, {
      id: 2,
      repositoryId: 1,
      repositoryName: "commitquest",
      key: "first-release",
      title: "Face the First Boss",
      description: "Ship the campaign's first tagged release.",
      position: 2,
      objectiveType: "release",
      target: 1,
      rewardXp: 250,
      baselineCount: 0,
      createdAt: "2026-07-16T10:00:00.000Z",
      completedAt: null,
      progress: 0,
      status: "active"
    }],
    bossBattles: [{
      id: 1,
      repositoryId: 1,
      repositoryName: "commitquest",
      version: "0.5.0",
      status: "preparing",
      testCommand: "npm test",
      releaseTag: null,
      createdAt: "2026-07-16T12:00:00.000Z",
      completedAt: null
    }],
    classes: [{
      id: "artificer",
      title: "Artificer",
      description: "Crafts features and interfaces.",
      affinityTypes: ["feat", "style"],
      skillTitles: [{ level: 1, title: "Workshop Initiate", description: "Begin the path." }],
      selected: true,
      classXp: 320,
      classLevel: 2,
      nextSkillAt: 500,
      unlockedSkills: [{ level: 1, title: "Workshop Initiate", description: "Begin the path." }]
    }],
    sharePreview: [
      "Aetherelic · Level 4 Code Explorer",
      "Workshop Initiate · 670 XP",
      "3 day streak · 21 commits",
      "2 campaigns · 1 release · 3 badges",
      "Privacy-safe by default: no paths or commit subjects."
    ],
    rewardModal: null,
    notice: "Journey refreshed · 1 new commit · 0 new releases · +55 activity XP",
    warnings: [],
    refreshedAt: "2026-07-16T12:00:00.000Z",
    onboardingRequired: false
  };
}

describe("interactive dashboard rendering", () => {
  it("renders every screen within the requested terminal bounds", () => {
    const model = populatedModel();
    const screens: TuiScreen[] = ["home", "quests", "campaigns", "chapters", "achievements", "progress", "path", "log", "share", "themes"];

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
    expect(questOutput).toContain("How To Progress");

    const achievementOutput = renderTui(
      model,
      { ...initialTuiState(), screen: "achievements" },
      { width: 100, height: 28 },
      { color: false }
    );
    expect(achievementOutput).toContain("◆ UNLOCKED");
    expect(achievementOutput).toContain("Ship It");
    expect(achievementOutput).toContain("Made with <3 by Aetherelic");
  });

  it("renders a live theme preview and saved-theme marker", () => {
    const state = { ...initialTuiState("tokyo-night"), screen: "themes" as const };
    const output = renderTui(
      populatedModel(),
      state,
      { width: 100, height: 28 },
      { color: false }
    );
    expect(output).toContain("Tokyo Night");
    expect(output).toContain("ACTIVE");
    expect(output).toContain("This theme is currently saved.");
  });


  it("renders the clean launcher and animated focus states", () => {
    const model = populatedModel();
    const base = stripAnsi(renderTui(
      model,
      initialTuiState(),
      { width: 132, height: 42 },
      { color: false, pulse: false }
    ));
    const pulsed = stripAnsi(renderTui(
      model,
      initialTuiState(),
      { width: 132, height: 42 },
      { color: false, pulse: true }
    ));
    expect(base).toContain("CURRENT OBJECTIVE");
    expect(base).toContain("Latest reward");
    expect(base).not.toContain("Choose Your Path");
    expect(pulsed).not.toBe(base);
  });

  it("fills wide quest, campaign, and badge screens with game panels", () => {
    const model = populatedModel();
    const size = { width: 150, height: 38 };
    const questOutput = stripAnsi(renderTui(model, { ...initialTuiState(), screen: "quests" }, size, { color: false }));
    expect(questOutput).toContain("Quest Summary");
    expect(questOutput).toContain("Next Objectives");
    expect(questOutput).toContain("How To Progress");

    const campaignOutput = stripAnsi(renderTui(model, { ...initialTuiState(), screen: "campaigns" }, size, { color: false }));
    expect(campaignOutput).toContain("Campaign Navigator");
    expect(campaignOutput).toContain("Campaign Overview");
    expect(campaignOutput).toContain("Recent Campaign Activity");

    const badgeOutput = stripAnsi(renderTui(model, { ...initialTuiState(), screen: "achievements" }, size, { color: false }));
    expect(badgeOutput).toContain("Badge Collection");
    expect(badgeOutput).toContain("Collection Stats");
    expect(badgeOutput).toContain("Recent Unlocks");
  });

  it("renders reward modals and the richer progress dashboard", () => {
    const model = {
      ...populatedModel(),
      rewardModal: {
        eyebrow: "QUEST COMPLETE",
        title: "+135 XP earned",
        lines: ["+55 XP  feat: add game dashboard", "Quest complete · Build Momentum · +80 XP"],
        totalXp: 135,
        seenThrough: "2026-07-16T12:00:00.000Z"
      }
    };
    const modalOutput = stripAnsi(renderTui(
      model,
      initialTuiState("tokyo-night", true),
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(modalOutput).toContain("Reward Unlocked");
    expect(modalOutput).toContain("QUEST COMPLETE");
    expect(modalOutput).toContain("Enter or Esc to continue");

    const progressOutput = stripAnsi(renderTui(
      model,
      { ...initialTuiState(), screen: "progress" },
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(progressOutput).toContain("Level Progress");
    expect(progressOutput).toContain("14-Day XP Trend");
    expect(progressOutput).toContain("Journey Milestones");
  });

  it("renders the searchable command palette, forms, confirmations, and onboarding", () => {
    const model = populatedModel();
    const palette = stripAnsi(renderTui(
      model,
      { ...initialTuiState(), overlay: { kind: "palette", query: "quest", selected: 0 } },
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(palette).toContain("Command Palette");
    expect(palette).toContain("Create Quest");

    const form = stripAnsi(renderTui(
      model,
      {
        ...initialTuiState(),
        overlay: {
          kind: "form",
          title: "Create New Quest",
          action: "quest-create",
          fields: [
            { key: "title", label: "Title", kind: "text", value: "Stable actions" },
            { key: "objectiveType", label: "Objective", kind: "choice", value: "feat", choices: [{ label: "feat", value: "feat" }] }
          ],
          fieldIndex: 0,
          error: null,
          submitLabel: "Create Quest",
          cancelLabel: "Cancel"
        }
      },
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(form).toContain("Create New Quest");
    expect(form).toContain("Stable actions");

    const confirm = stripAnsi(renderTui(
      model,
      {
        ...initialTuiState(),
        overlay: {
          kind: "confirm",
          title: "Remove Campaign",
          message: ["Tracking data will be removed."],
          action: "campaign-remove",
          confirmLabel: "Remove",
          dangerous: true,
          verification: "commitquest",
          typed: "commit",
          error: null
        }
      },
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(confirm).toContain("Remove Campaign");
    expect(confirm).toContain("commitquest");

    const onboarding = stripAnsi(renderTui(
      model,
      initialTuiState("tokyo-night", false, true),
      { width: 120, height: 36 },
      { color: false }
    ));
    expect(onboarding).toContain("WELCOME TO COMMITQUEST");
    expect(onboarding).toContain("Everything remains local");
  });

  it("renders full detail views and screen-specific action hints", () => {
    const model = populatedModel();
    const questDetail = stripAnsi(renderTui(
      model,
      { ...initialTuiState(), screen: "quests", overlay: { kind: "detail", screen: "quests" } },
      { width: 130, height: 38 },
      { color: false }
    ));
    expect(questDetail).toContain("Quest controls");
    expect(questDetail).toContain("N create · E edit");

    const campaign = stripAnsi(renderTui(
      model,
      { ...initialTuiState(), screen: "campaigns" },
      { width: 130, height: 38 },
      { color: false }
    ));
    expect(campaign).toContain("N Add");
    expect(campaign).toContain("S Scan");
    expect(campaign).toContain("/ Commands");
  });

  it("renders chapters, developer paths, and privacy-safe sharing screens", () => {
    const model = populatedModel();
    const chapters = renderTui(model, { ...initialTuiState(), screen: "chapters" }, { width: 132, height: 36 }, { color: false });
    expect(chapters).toContain("Face the First Boss");
    expect(chapters).toContain("Boss Encounters");

    const pathOutput = renderTui(model, { ...initialTuiState(), screen: "path" }, { width: 132, height: 36 }, { color: false });
    expect(pathOutput).toContain("Artificer");
    expect(pathOutput).toContain("Skill Path");

    const share = renderTui(model, { ...initialTuiState(), screen: "share" }, { width: 132, height: 36 }, { color: false });
    expect(share).toContain("PRIVACY SHIELD");
    expect(share).toContain("Repository paths excluded");
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
