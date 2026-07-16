import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  addRepository,
  createCustomQuest,
  findRepository,
  getCustomQuest,
  listRepositories,
  openDatabase
} from "../src/data/database.js";
import {
  availablePaletteEntries,
  executeConfirmedAction,
  executeFormOverlay,
  openTuiAction
} from "../src/tui/actions.js";
import { initialTuiState } from "../src/tui/navigation.js";
import type { TuiFormOverlay, TuiModel } from "../src/tui/types.js";

const directories: string[] = [];

function temporaryHome(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-tui-actions-"));
  directories.push(directory);
  process.env.COMMITQUEST_HOME = directory;
  return directory;
}

function model(overrides: Partial<TuiModel> = {}): TuiModel {
  return {
    profile: { name: "Aetherelic", email: "developer@example.com" },
    level: { level: 3, title: "Code Explorer", currentLevelXp: 275, nextLevelXp: 525, xpIntoLevel: 20, xpNeeded: 250, percentage: 8 },
    totalXp: 295,
    streak: { current: 2, longest: 3 },
    stats: { commits: 2, repositories: 1, releases: 0, questRewards: 0, achievements: 1 },
    quests: [],
    rewardedQuestKeys: new Set(),
    customQuests: [],
    achievements: [],
    campaigns: [],
    recentActivity: [],
    commitTypes: [],
    dailyXp: [],
    rewardModal: null,
    notice: null,
    warnings: [],
    refreshedAt: "2026-07-16T12:00:00.000Z",
    onboardingRequired: false,
    ...overrides
  };
}

function form(action: TuiFormOverlay["action"], fields: TuiFormOverlay["fields"]): TuiFormOverlay {
  return {
    kind: "form",
    title: "Test Form",
    action,
    fields,
    fieldIndex: 0,
    error: null,
    submitLabel: "Save",
    cancelLabel: "Cancel"
  };
}

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("interactive quest actions", () => {
  it("creates and edits a custom quest through validated forms", () => {
    temporaryHome();
    const creation = executeFormOverlay(form("quest-create", [
      { key: "title", label: "Title", kind: "text", value: "Ship stable UI" },
      { key: "repositoryId", label: "Campaign", kind: "choice", value: "", choices: [] },
      { key: "objectiveType", label: "Objective", kind: "choice", value: "feat", choices: [] },
      { key: "target", label: "Target", kind: "number", value: "2" },
      { key: "rewardXp", label: "Reward", kind: "number", value: "150" },
      { key: "deadline", label: "Deadline", kind: "text", value: "2026-08-01" }
    ]), model());

    expect(creation.notice).toContain("Quest created");
    let db = openDatabase();
    const created = getCustomQuest(db, 1);
    expect(created?.title).toBe("Ship stable UI");
    expect(created?.target).toBe(2);
    db.close();

    const editing = executeFormOverlay(form("quest-edit", [
      { key: "title", label: "Title", kind: "text", value: "Ship polished UI" },
      { key: "repositoryId", label: "Campaign", kind: "choice", value: "", choices: [] },
      { key: "objectiveType", label: "Objective", kind: "choice", value: "docs", choices: [] },
      { key: "target", label: "Target", kind: "number", value: "1" },
      { key: "rewardXp", label: "Reward", kind: "number", value: "200" },
      { key: "deadline", label: "Deadline", kind: "text", value: "" },
      { key: "questId", label: "ID", kind: "text", value: "1", secret: true }
    ]), model());

    expect(editing.notice).toContain("Quest updated");
    db = openDatabase();
    const updated = getCustomQuest(db, 1);
    expect(updated?.title).toBe("Ship polished UI");
    expect(updated?.objectiveType).toBe("docs");
    expect(updated?.rewardXp).toBe(200);
    db.close();
  });

  it("opens only valid quest actions for the selected custom quest", () => {
    const customQuest = {
      id: 3,
      title: "Manual milestone",
      repositoryId: null,
      repositoryName: null,
      objectiveType: "manual" as const,
      target: 1,
      rewardXp: 100,
      baselineCount: 0,
      createdAt: "2026-07-16T10:00:00.000Z",
      deadlineAt: null,
      completedAt: null,
      abandonedAt: null,
      progress: 0,
      complete: false,
      status: "active" as const,
      description: "Complete the milestone."
    };
    const data = model({ customQuests: [customQuest] });
    const state = { ...initialTuiState(), screen: "quests" as const };
    expect(openTuiAction(state, "quest-edit", data).overlay?.kind).toBe("form");
    expect(openTuiAction(state, "quest-complete", data).overlay?.kind).toBe("confirm");
    expect(availablePaletteEntries(data, state).find((entry) => entry.id === "quest-complete")?.enabled).toBe(true);
  });
});

describe("interactive campaign actions", () => {
  it("adds a real Git repository without enabling a hook when disabled", () => {
    const home = temporaryHome();
    const repositoryPath = path.join(home, "project");
    fs.mkdirSync(repositoryPath);
    execFileSync("git", ["init", "-b", "main"], { cwd: repositoryPath, stdio: "ignore" });

    const result = executeFormOverlay(form("campaign-add", [
      { key: "path", label: "Path", kind: "text", value: repositoryPath },
      { key: "name", label: "Name", kind: "text", value: "stable-project" },
      { key: "liveRewards", label: "Hook", kind: "boolean", value: "false" }
    ]), model());

    expect(result.notice).toContain("stable-project");
    const db = openDatabase();
    expect(findRepository(db, repositoryPath)?.name).toBe("stable-project");
    db.close();
  });

  it("archives, restores, and safely removes tracking data", () => {
    temporaryHome();
    let db = openDatabase();
    const repository = addRepository(db, { name: "commitquest", path: "/tmp/commitquest-actions", defaultBranch: "main" });
    db.close();

    const campaign = { ...repository, commits: 0, releases: 0, earnedXp: 0, lastActivityAt: null };
    const data = model({ campaigns: [campaign], stats: { commits: 0, repositories: 1, releases: 0, questRewards: 0, achievements: 0 } });
    const state = { ...initialTuiState(), screen: "campaigns" as const };

    expect(executeConfirmedAction("campaign-archive", data, state).notice).toContain("archived");
    db = openDatabase();
    expect(listRepositories(db)[0]?.archived).toBe(true);
    db.close();

    const archivedData = model({ campaigns: [{ ...campaign, archived: true }] });
    expect(executeConfirmedAction("campaign-restore", archivedData, state).notice).toContain("restored");
    db = openDatabase();
    expect(listRepositories(db)[0]?.archived).toBe(false);
    db.close();

    expect(executeConfirmedAction("campaign-remove", data, state).notice).toContain("removed");
    db = openDatabase();
    expect(listRepositories(db)).toHaveLength(0);
    db.close();
  });
});
