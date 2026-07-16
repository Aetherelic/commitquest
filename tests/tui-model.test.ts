import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addRepository, insertCommit, openDatabase } from "../src/data/database.js";
import { updateProfile } from "../src/core/profile.js";
import { acknowledgeTuiRewards, loadTuiModel } from "../src/tui/model.js";

const originalHome = process.env.COMMITQUEST_HOME;
const temporaryHomes: string[] = [];

function useTemporaryHome(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-tui-"));
  temporaryHomes.push(directory);
  process.env.COMMITQUEST_HOME = directory;
  return directory;
}

afterEach(() => {
  if (originalHome === undefined) delete process.env.COMMITQUEST_HOME;
  else process.env.COMMITQUEST_HOME = originalHome;
  for (const directory of temporaryHomes.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("TUI model", () => {
  it("loads a safe empty journey", () => {
    useTemporaryHome();
    const model = loadTuiModel({ scan: false, now: new Date("2026-07-16T12:00:00.000Z") });
    expect(model.profile.name).toBe("Adventurer");
    expect(model.stats.repositories).toBe(0);
    expect(model.campaigns).toEqual([]);
    expect(model.recentActivity).toEqual([]);
    expect(model.quests.length).toBeGreaterThan(0);
  });

  it("builds campaign, progress, quest, badge, and log data from SQLite", () => {
    useTemporaryHome();
    const db = openDatabase();
    updateProfile(db, { name: "Aetherelic", email: "developer@example.com" });
    const repository = addRepository(db, {
      name: "commitquest",
      path: "/tmp/commitquest",
      defaultBranch: "main"
    });
    insertCommit(db, repository.id, {
      hash: "abcdef1234567890",
      authorName: "Aetherelic",
      authorEmail: "developer@example.com",
      authoredAt: "2026-07-16T10:00:00.000Z",
      subject: "feat: add interactive dashboard",
      type: "feat",
      filesChanged: 4,
      insertions: 200,
      deletions: 10,
      baseXp: 55
    }, 55, true);
    db.close();

    const model = loadTuiModel({ scan: false, now: new Date("2026-07-16T12:00:00.000Z") });
    expect(model.profile.name).toBe("Aetherelic");
    expect(model.stats.commits).toBe(1);
    expect(model.campaigns[0]).toMatchObject({ name: "commitquest", commits: 1, earnedXp: 55 });
    expect(model.recentActivity[0]?.subject).toBe("feat: add interactive dashboard");
    expect(model.commitTypes[0]).toMatchObject({ type: "feat", count: 1, xp: 55 });
    expect(model.achievements.find((badge) => badge.key === "first-commit")?.unlocked).toBe(true);
    expect(model.quests.find((quest) => quest.title === "First Step")?.complete).toBe(true);
    expect(model.rewardModal?.lines.some((line) => line.includes("Quest complete"))).toBe(true);
    expect(model.rewardModal?.lines.some((line) => line.includes("Badge unlocked"))).toBe(true);
    expect(model.totalXp).toBeGreaterThan(55);

    acknowledgeTuiRewards("2999-01-01T00:00:00.000Z");
    const acknowledged = loadTuiModel({ scan: false, now: new Date("2026-07-16T12:00:01.000Z") });
    expect(acknowledged.rewardModal).toBeNull();
  });
});
