import chalk from "chalk";
import { openDatabase, addRepository } from "../data/database.js";
import {
  getDefaultBranch,
  getRepositoryName,
  isGitRepository,
  resolveRepositoryPath
} from "../git/git.js";
import { failure, success } from "../ui/render.js";
import { ensureDefaultChapters } from "../core/chapters.js";

export interface AddOptions {
  name?: string;
}

export function addCommand(inputPath: string, options: AddOptions): void {
  let repositoryPath: string;
  try {
    repositoryPath = resolveRepositoryPath(inputPath);
  } catch {
    throw new Error(`Path does not exist: ${inputPath}`);
  }

  if (!isGitRepository(repositoryPath)) {
    console.log(failure(`${repositoryPath} is not a Git repository.`));
    process.exitCode = 1;
    return;
  }

  const db = openDatabase();
  const repository = addRepository(db, {
    name: options.name ?? getRepositoryName(repositoryPath),
    path: repositoryPath,
    defaultBranch: getDefaultBranch(repositoryPath)
  });

  ensureDefaultChapters(db, repository);

  console.log(success(`Campaign added: ${chalk.bold(repository.name)}`));
  console.log(chalk.dim(`  ${repository.path}`));
  console.log(chalk.dim("\nNext: cq scan"));
  db.close();
}
