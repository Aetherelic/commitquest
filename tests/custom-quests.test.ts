import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  abandonCustomQuest,
  addRepository,
  createCustomQuest,
  insertCommit,
  openDatabase,
  totalXp
} from "../src/data/database.js";
import {
  completeManualCustomQuest,
  customQuestStates,
  syncCustomQuestRewards
} from "../src/core/custom-quests.js";
import type { GitCommit } from "../src/core/types.js";
import type { CustomQuestObjective } from "../src/core/types.js";

const temporaryDirectories: string[] = [];

function createDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-custom-quests-"));
  temporaryDirectories.push(directory);
  process.env.COMMITQUEST_HOME = directory;
  return openDatabase();
}

function commit(hash: string, type: GitCommit["type"]): GitCommit {
  return {
    hash,
    authorName: "Quest Tester",
    authorEmail: "quest@example.com",
    authoredAt: "2026-07-16T12:00:00.000Z",
    subject: `${type}: quest progress`,
    type,
    filesChanged: 1,
    insertions: 1,
    deletions: 0,
    baseXp: 20
  };
}

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("custom quests", () => {
  it.each([
    "perf",
    "build",
    "ci",
    "chore",
    "style",
    "revert"
  ] satisfies CustomQuestObjective[])("supports %s commit objectives", (objectiveType) => {
    const db = createDatabase();
    const repository = addRepository(db, {
      name: objectiveType,
      path: `/tmp/${objectiveType}`,
      defaultBranch: "main"
    });
    const quest = createCustomQuest(db, {
      title: `Complete ${objectiveType} work`,
      repositoryId: repository.id,
      objectiveType,
      target: 1,
      rewardXp: 40,
      deadlineAt: null
    });

    insertCommit(db, repository.id, commit(`${objectiveType}-commit`, objectiveType), 10, true);
    const state = syncCustomQuestRewards(db).find((item) => item.id === quest.id);

    expect(state?.status).toBe("complete");
    expect(state?.progress).toBe(1);
    db.close();
  });

  it("tracks only activity created after the quest baseline", () => {
    const db = createDatabase();
    const repository = addRepository(db, {
      name: "commitquest",
      path: "/tmp/commitquest",
      defaultBranch: "main"
    });

    insertCommit(db, repository.id, commit("existing", "docs"), 15, true);
    const quest = createCustomQuest(db, {
      title: "Improve the guide",
      repositoryId: repository.id,
      objectiveType: "docs",
      target: 1,
      rewardXp: 100,
      deadlineAt: null
    });

    expect(customQuestStates(db).find((state) => state.id === quest.id)?.progress).toBe(0);

    insertCommit(db, repository.id, commit("new", "docs"), 15, true);
    const [state] = syncCustomQuestRewards(db).filter((item) => item.id === quest.id);

    expect(state?.status).toBe("complete");
    expect(state?.progress).toBe(1);
    expect(totalXp(db)).toBe(130);

    syncCustomQuestRewards(db);
    expect(totalXp(db)).toBe(130);
    db.close();
  });

  it("keeps campaign-specific progress isolated", () => {
    const db = createDatabase();
    const first = addRepository(db, {
      name: "first",
      path: "/tmp/first",
      defaultBranch: "main"
    });
    const second = addRepository(db, {
      name: "second",
      path: "/tmp/second",
      defaultBranch: "main"
    });
    const quest = createCustomQuest(db, {
      title: "Fix the first campaign",
      repositoryId: first.id,
      objectiveType: "fix",
      target: 1,
      rewardXp: 60,
      deadlineAt: null
    });

    insertCommit(db, second.id, commit("wrong-campaign", "fix"), 20, true);
    expect(customQuestStates(db).find((state) => state.id === quest.id)?.progress).toBe(0);

    insertCommit(db, first.id, commit("right-campaign", "fix"), 20, true);
    expect(syncCustomQuestRewards(db).find((state) => state.id === quest.id)?.status).toBe("complete");
    db.close();
  });

  it("supports manually completed milestones without duplicate rewards", () => {
    const db = createDatabase();
    const quest = createCustomQuest(db, {
      title: "Design the dashboard",
      repositoryId: null,
      objectiveType: "manual",
      target: 1,
      rewardXp: 75,
      deadlineAt: null
    });

    const completed = completeManualCustomQuest(db, quest.id, new Date("2026-07-16T12:00:00.000Z"));
    expect(completed.status).toBe("complete");
    expect(totalXp(db)).toBe(75);

    completeManualCustomQuest(db, quest.id, new Date("2026-07-16T13:00:00.000Z"));
    expect(totalXp(db)).toBe(75);
    db.close();
  });

  it("does not advance automatic quests from historical activity", () => {
    const db = createDatabase();
    const repository = addRepository(db, {
      name: "history",
      path: "/tmp/history",
      defaultBranch: "main"
    });
    const quest = createCustomQuest(db, {
      title: "Build forward",
      repositoryId: repository.id,
      objectiveType: "feat",
      target: 1,
      rewardXp: 80,
      deadlineAt: null
    });

    insertCommit(db, repository.id, commit("historical", "feat"), 40, false);
    const state = syncCustomQuestRewards(db).find((item) => item.id === quest.id);

    expect(state?.status).toBe("active");
    expect(state?.progress).toBe(0);
    db.close();
  });

  it("keeps abandoned quests from completing", () => {
    const db = createDatabase();
    const repository = addRepository(db, {
      name: "abandoned",
      path: "/tmp/abandoned",
      defaultBranch: "main"
    });
    const quest = createCustomQuest(db, {
      title: "Old plan",
      repositoryId: repository.id,
      objectiveType: "test",
      target: 1,
      rewardXp: 50,
      deadlineAt: null
    });

    abandonCustomQuest(db, quest.id, "2026-07-16T10:00:00.000Z");
    insertCommit(db, repository.id, commit("test-after-abandon", "test"), 25, true);
    const state = syncCustomQuestRewards(db).find((item) => item.id === quest.id);

    expect(state?.status).toBe("abandoned");
    expect(totalXp(db)).toBe(25);
    db.close();
  });
});
