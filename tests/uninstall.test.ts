import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectLocalInstallation, uninstallLocalInstallation } from "../src/core/uninstall.js";
import { getConfigDirectory, getDataDirectory } from "../src/data/paths.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fakeInstall(): { root: string; executable: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-install-"));
  directories.push(root);
  const packageRoot = path.join(root, "lib", "node_modules", "commitquest");
  const executable = path.join(packageRoot, "dist", "cli.js");
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, "#!/usr/bin/env node\n");
  fs.mkdirSync(path.join(root, "bin"), { recursive: true });
  fs.symlinkSync(executable, path.join(root, "bin", "cq"));
  fs.symlinkSync("cq", path.join(root, "bin", "commitquest"));
  return { root, executable };
}

describe("local uninstall", () => {
  it("detects a local npm installation and preserves data by default", () => {
    const install = fakeInstall();
    const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-data-"));
    directories.push(dataHome);
    process.env.COMMITQUEST_HOME = dataHome;
    fs.mkdirSync(getDataDirectory(), { recursive: true });
    fs.writeFileSync(path.join(getDataDirectory(), "progress.txt"), "keep");

    const detected = detectLocalInstallation(install.executable);
    expect(detected?.prefix).toBe(install.root);
    const result = uninstallLocalInstallation(detected!);
    expect(result.removedApplication).toBe(true);
    expect(fs.existsSync(path.join(install.root, "lib", "node_modules", "commitquest"))).toBe(false);
    expect(fs.existsSync(path.join(getDataDirectory(), "progress.txt"))).toBe(true);
  });

  it("purges data only when explicitly requested", () => {
    const install = fakeInstall();
    const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-purge-"));
    directories.push(dataHome);
    process.env.COMMITQUEST_HOME = dataHome;
    fs.mkdirSync(getDataDirectory(), { recursive: true });
    fs.mkdirSync(getConfigDirectory(), { recursive: true });

    uninstallLocalInstallation(detectLocalInstallation(install.executable)!, { purgeData: true });
    expect(fs.existsSync(getDataDirectory())).toBe(false);
    expect(fs.existsSync(getConfigDirectory())).toBe(false);
  });

  it("refuses to treat Nix store paths as mutable local installs", () => {
    expect(detectLocalInstallation("/nix/store/example/lib/node_modules/commitquest/dist/cli.js")).toBeNull();
  });
});
