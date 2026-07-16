import fs from "node:fs";
import { execFileSync } from "node:child_process";
import chalk from "chalk";
import {
  checkpointDatabase,
  databaseIntegrity,
  listRepositories,
  openDatabase,
  setMeta
} from "../data/database.js";
import {
  getBackupDirectory,
  getConfigDirectory,
  getCrashDirectory,
  getDatabasePath,
  getDataDirectory,
  getShareDirectory
} from "../data/paths.js";
import { createBackup } from "../core/backup.js";
import { getProfile } from "../core/profile.js";
import { isGitRepository } from "../git/git.js";
import { installPostCommitHook } from "../git/hooks.js";
import { failure, success, warning } from "../ui/render.js";
import { APP_VERSION } from "../version.js";

function gitVersion(): string | null {
  try {
    return execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* unsupported filesystem */ }
}

export function doctorCommand(options: { repair?: boolean } = {}): void {
  const repair = options.repair ?? false;
  const checks: Array<{ ok: boolean; message: string; warning?: boolean }> = [];
  const repairs: string[] = [];
  const nodeParts = process.versions.node.split(".").map(Number);
  const nodeOk = (nodeParts[0] ?? 0) > 22 || ((nodeParts[0] ?? 0) === 22 && (nodeParts[1] ?? 0) >= 5);
  checks.push({ ok: nodeOk, message: `Node.js ${process.versions.node} (22.5+ required)` });

  const git = gitVersion();
  checks.push({ ok: Boolean(git), message: git ?? "Git is not available" });

  if (repair) {
    ensurePrivateDirectory(getDataDirectory());
    ensurePrivateDirectory(getConfigDirectory());
    ensurePrivateDirectory(getBackupDirectory());
    ensurePrivateDirectory(getCrashDirectory());
    ensurePrivateDirectory(getShareDirectory());
    repairs.push("secured CommitQuest data directories");
  }

  if (repair && fs.existsSync(getDatabasePath())) {
    const backup = createBackup({ kind: "manual", appVersion: APP_VERSION });
    repairs.push(`created safety backup ${backup.id}`);
  }

  const db = openDatabase();
  try {
    const integrity = databaseIntegrity(db);
    checks.push({ ok: integrity === "ok", message: `Database integrity: ${integrity}` });
    const profile = getProfile(db);
    checks.push({ ok: Boolean(profile.email), warning: !profile.email, message: profile.email ? `Profile email: ${profile.email}` : "Profile email is missing" });
    checks.push({ ok: fs.existsSync(getDatabasePath()), message: `Database: ${getDatabasePath()}` });
    checks.push({ ok: fs.existsSync(getDataDirectory()), message: `Data directory: ${getDataDirectory()}` });

    if (repair && integrity === "ok") {
      checkpointDatabase(db);
      repairs.push("checkpointed SQLite WAL");
    }

    for (const repository of listRepositories(db)) {
      const valid = isGitRepository(repository.path);
      checks.push({
        ok: valid || repository.archived,
        warning: repository.archived && !valid,
        message: `${repository.name}${repository.archived ? " [archived]" : ""}: ${repository.path}`
      });
      if (repair && valid && !repository.archived) {
        installPostCommitHook(repository.path, { nodePath: process.execPath, cliPath: process.argv[1] ?? "commitquest" });
        repairs.push(`verified live-reward hook for ${repository.name}`);
      }
    }

    if (repair) setMeta(db, "doctor.last-repair", new Date().toISOString());
  } finally {
    db.close();
  }

  console.log(chalk.bold.magenta(`COMMITQUEST DOCTOR${repair ? " · REPAIR" : ""}\n`));
  for (const check of checks) {
    if (check.ok) console.log(success(check.message));
    else if (check.warning) console.log(warning(check.message));
    else console.log(failure(check.message));
  }
  if (repairs.length > 0) {
    console.log(chalk.bold("\nREPAIRS"));
    for (const item of repairs) console.log(success(item));
  }
}
