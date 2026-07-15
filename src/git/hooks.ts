import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MANAGED_MARKER = "# commitquest: managed post-commit hook";
const BACKUP_SUFFIX = ".commitquest-original";

export interface HookRuntime {
  nodePath: string;
  cliPath: string;
}

export interface HookStatus {
  enabled: boolean;
  hookPath: string;
  backupPath: string;
  preservesExistingHook: boolean;
}

export interface HookInstallResult extends HookStatus {
  preservedExistingHook: boolean;
}

export interface HookRemoveResult extends HookStatus {
  removed: boolean;
  restoredExistingHook: boolean;
}

function runGit(repositoryPath: string, args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function isManagedHook(hookPath: string): boolean {
  if (!fs.existsSync(hookPath)) return false;
  try {
    return fs.readFileSync(hookPath, "utf8").includes(MANAGED_MARKER);
  } catch {
    return false;
  }
}

export function getPostCommitHookPath(repositoryPath: string): string {
  const rawPath = runGit(repositoryPath, ["rev-parse", "--git-path", "hooks/post-commit"]);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(repositoryPath, rawPath);
}

function buildManagedHook(runtime: HookRuntime, backupPath: string): string {
  return `#!/bin/sh
${MANAGED_MARKER}

original_hook=${shellQuote(backupPath)}
node_runtime=${shellQuote(runtime.nodePath)}
commitquest_cli=${shellQuote(runtime.cliPath)}

if [ -x "$original_hook" ]; then
  "$original_hook" "$@" || true
fi

repository="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [ -x "$node_runtime" ] && [ -f "$commitquest_cli" ]; then
  "$node_runtime" "$commitquest_cli" scan --repo "$repository" --hook || true
fi

exit 0
`;
}

export function getPostCommitHookStatus(repositoryPath: string): HookStatus {
  const hookPath = getPostCommitHookPath(repositoryPath);
  const backupPath = `${hookPath}${BACKUP_SUFFIX}`;
  return {
    enabled: isManagedHook(hookPath),
    hookPath,
    backupPath,
    preservesExistingHook: fs.existsSync(backupPath)
  };
}

export function installPostCommitHook(
  repositoryPath: string,
  runtime: HookRuntime
): HookInstallResult {
  const hookPath = getPostCommitHookPath(repositoryPath);
  const backupPath = `${hookPath}${BACKUP_SUFFIX}`;
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });

  let preservedExistingHook = fs.existsSync(backupPath);
  if (fs.existsSync(hookPath) && !isManagedHook(hookPath)) {
    if (fs.existsSync(backupPath)) {
      throw new Error(`Cannot preserve the existing hook because ${backupPath} already exists.`);
    }
    fs.renameSync(hookPath, backupPath);
    preservedExistingHook = true;
  }

  fs.writeFileSync(hookPath, buildManagedHook(runtime, backupPath), { mode: 0o755 });
  fs.chmodSync(hookPath, 0o755);

  return {
    enabled: true,
    hookPath,
    backupPath,
    preservesExistingHook: preservedExistingHook,
    preservedExistingHook
  };
}

export function removePostCommitHook(repositoryPath: string): HookRemoveResult {
  const status = getPostCommitHookStatus(repositoryPath);
  if (!status.enabled) {
    return {
      ...status,
      removed: false,
      restoredExistingHook: false
    };
  }

  fs.rmSync(status.hookPath, { force: true });
  let restoredExistingHook = false;
  if (fs.existsSync(status.backupPath)) {
    fs.renameSync(status.backupPath, status.hookPath);
    restoredExistingHook = true;
  }

  return {
    ...getPostCommitHookStatus(repositoryPath),
    removed: true,
    restoredExistingHook
  };
}
