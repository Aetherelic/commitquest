import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { findRepository, openDatabase } from "../data/database.js";
import { getRepositoryRoot, isGitRepository, resolveRepositoryPath } from "../git/git.js";
import {
  getPostCommitHookStatus,
  installPostCommitHook,
  removePostCommitHook
} from "../git/hooks.js";
import { failure, success, warning } from "../ui/render.js";

function resolveRoot(inputPath: string): string | null {
  let resolved: string;
  try {
    resolved = resolveRepositoryPath(inputPath);
  } catch {
    console.log(failure(`Path does not exist: ${inputPath}`));
    process.exitCode = 1;
    return null;
  }

  if (!isGitRepository(resolved)) {
    console.log(failure(`${resolved} is not a Git repository.`));
    process.exitCode = 1;
    return null;
  }

  return getRepositoryRoot(resolved);
}

function installedCliPath(): string {
  const commandDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(commandDirectory, "../cli.js");
}

export function installHookCommand(inputPath = "."): void {
  const repositoryPath = resolveRoot(inputPath);
  if (!repositoryPath) return;

  const db = openDatabase();
  const repository = findRepository(db, repositoryPath);
  if (!repository) {
    console.log(warning(`Campaign is not tracked yet: ${repositoryPath}`));
    console.log(chalk.dim(`  Add it first with cq add ${repositoryPath}`));
    db.close();
    process.exitCode = 1;
    return;
  }

  const result = installPostCommitHook(repositoryPath, {
    nodePath: process.execPath,
    cliPath: installedCliPath()
  });

  console.log(success(`Live rewards enabled for ${chalk.bold(repository.name)}.`));
  console.log(chalk.dim(`  ${result.hookPath}`));
  if (result.preservedExistingHook) {
    console.log(chalk.dim("  Your existing post-commit hook was preserved and will still run."));
  }
  console.log(chalk.dim("\nYour next commit will be scanned automatically."));
  db.close();
}

export function removeHookCommand(inputPath = "."): void {
  const repositoryPath = resolveRoot(inputPath);
  if (!repositoryPath) return;

  const result = removePostCommitHook(repositoryPath);
  if (!result.removed) {
    console.log(warning("CommitQuest live rewards are not enabled for this hook path."));
    return;
  }

  console.log(success("CommitQuest live rewards disabled."));
  if (result.restoredExistingHook) {
    console.log(chalk.dim("  The original post-commit hook was restored."));
  }
}

export function hookStatusCommand(inputPath = "."): void {
  const repositoryPath = resolveRoot(inputPath);
  if (!repositoryPath) return;

  const status = getPostCommitHookStatus(repositoryPath);
  console.log(chalk.bold.magenta("LIVE REWARDS\n"));
  console.log(status.enabled
    ? success("Automatic post-commit scanning is enabled.")
    : warning("Automatic post-commit scanning is disabled."));
  console.log(chalk.dim(`  ${status.hookPath}`));
  if (status.preservesExistingHook) {
    console.log(chalk.dim("  An existing hook is preserved behind the CommitQuest wrapper."));
  }
}
