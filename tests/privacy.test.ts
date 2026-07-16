import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPrivacyAudit } from "../src/core/privacy.js";
import { addRepository, openDatabase } from "../src/data/database.js";
import { getBackupDirectory, getCrashDirectory, getShareDirectory } from "../src/data/paths.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("privacy audit", () => {
  it("reports only local storage and privacy-safe sharing defaults", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-privacy-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;
    const db = openDatabase();
    addRepository(db, { name: "demo", path: path.join(directory, "repo"), defaultBranch: "main" });
    db.close();
    for (const target of [getBackupDirectory(), getCrashDirectory(), getShareDirectory()]) fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(getCrashDirectory(), "crash.txt"), "test");

    const audit = createPrivacyAudit();
    expect(audit.networkAccess).toBe("none");
    expect(audit.defaultShareIncludesProjects).toBe(false);
    expect(audit.campaigns).toBe(1);
    expect(audit.crashReports).toBe(1);
    expect(audit.storesCommitSubjectsLocally).toBe(true);
  });
});
