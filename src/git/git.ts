import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { GitCommit } from "../core/types.js";
import { calculateBaseXp, classifyCommit } from "../core/xp.js";

function runGit(repositoryPath: string, args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024
  }).trim();
}

export function isGitRepository(repositoryPath: string): boolean {
  try {
    return runGit(repositoryPath, ["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function resolveRepositoryPath(inputPath: string): string {
  return fs.realpathSync(path.resolve(inputPath));
}

export function getRepositoryRoot(repositoryPath: string): string {
  return fs.realpathSync(runGit(repositoryPath, ["rev-parse", "--show-toplevel"]));
}

export function getRepositoryName(repositoryPath: string): string {
  try {
    const topLevel = runGit(repositoryPath, ["rev-parse", "--show-toplevel"]);
    return path.basename(topLevel);
  } catch {
    return path.basename(repositoryPath);
  }
}

export function getDefaultBranch(repositoryPath: string): string | null {
  try {
    return runGit(repositoryPath, ["symbolic-ref", "--short", "HEAD"]);
  } catch {
    return null;
  }
}

export function getGitConfig(key: string, repositoryPath?: string): string | null {
  try {
    if (repositoryPath) return runGit(repositoryPath, ["config", "--get", key]);
    return execFileSync("git", ["config", "--global", "--get", key], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

export function readCommits(repositoryPath: string): GitCommit[] {
  let output: string;
  try {
    output = runGit(repositoryPath, [
    "log",
    "--all",
    "--date=iso-strict",
    "--pretty=format:%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s",
      "--numstat"
    ]);
  } catch {
    return [];
  }

  if (!output) return [];

  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const lines = record.split("\n");
      const header = lines.shift() ?? "";
      const [hash = "", authorName = "", authorEmail = "", authoredAt = "", subject = ""] = header.split("\x1f");

      let insertions = 0;
      let deletions = 0;
      let filesChanged = 0;

      for (const line of lines) {
        const match = line.match(/^(\d+|-)\t(\d+|-)\t/);
        if (!match) continue;
        filesChanged += 1;
        if (match[1] !== "-") insertions += Number(match[1]);
        if (match[2] !== "-") deletions += Number(match[2]);
      }

      const classification = classifyCommit(subject);
      return {
        hash,
        authorName,
        authorEmail,
        authoredAt,
        subject,
        type: classification.type,
        filesChanged,
        insertions,
        deletions,
        baseXp: calculateBaseXp(classification.type, filesChanged, classification.breaking)
      } satisfies GitCommit;
    });
}

export interface GitTag {
  name: string;
  commitHash: string;
  taggedAt: string;
}

export function readTags(repositoryPath: string): GitTag[] {
  const output = runGit(repositoryPath, [
    "for-each-ref",
    "refs/tags",
    "--sort=creatordate",
    "--format=%(refname:short)%09%(objectname)%09%(creatordate:iso-strict)"
  ]);

  if (!output) return [];
  return output.split("\n").filter(Boolean).map((line) => {
    const [name = "", commitHash = "", taggedAt = new Date(0).toISOString()] = line.split("\t");
    return { name, commitHash, taggedAt };
  });
}
