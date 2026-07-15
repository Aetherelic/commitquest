import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  getPostCommitHookPath,
  getPostCommitHookStatus,
  installPostCommitHook,
  removePostCommitHook
} from "../src/git/hooks.js";

const temporaryDirectories: string[] = [];

function createRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-hook-"));
  temporaryDirectories.push(root);
  execFileSync("git", ["init", "-b", "main", root], { stdio: "ignore" });
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("post-commit hooks", () => {
  it("installs an executable, idempotent CommitQuest hook", () => {
    const repository = createRepository();
    const runtime = { nodePath: "/nix/store/node/bin/node", cliPath: "/home/test/commitquest/dist/cli.js" };

    installPostCommitHook(repository, runtime);
    installPostCommitHook(repository, runtime);

    const hookPath = getPostCommitHookPath(repository);
    const contents = fs.readFileSync(hookPath, "utf8");
    const markerCount = contents.split("commitquest: managed post-commit hook").length - 1;

    expect(markerCount).toBe(1);
    expect(contents).toContain("scan --repo \"$repository\" --hook");
    expect(contents).toContain(runtime.nodePath);
    expect((fs.statSync(hookPath).mode & 0o111) !== 0).toBe(true);
    expect(getPostCommitHookStatus(repository).enabled).toBe(true);
  });

  it("preserves and restores an existing post-commit hook", () => {
    const repository = createRepository();
    const hookPath = getPostCommitHookPath(repository);
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    const original = "#!/usr/bin/env python3\nprint('existing hook')\n";
    fs.writeFileSync(hookPath, original, { mode: 0o755 });

    const installed = installPostCommitHook(repository, {
      nodePath: "/node",
      cliPath: "/commitquest/cli.js"
    });

    expect(installed.preservedExistingHook).toBe(true);
    expect(fs.readFileSync(installed.backupPath, "utf8")).toBe(original);

    const removed = removePostCommitHook(repository);
    expect(removed.removed).toBe(true);
    expect(removed.restoredExistingHook).toBe(true);
    expect(fs.readFileSync(hookPath, "utf8")).toBe(original);
  });

  it("reports a no-op when no managed hook is installed", () => {
    const repository = createRepository();
    const result = removePostCommitHook(repository);

    expect(result.removed).toBe(false);
    expect(result.restoredExistingHook).toBe(false);
  });
});
