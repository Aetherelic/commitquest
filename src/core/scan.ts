import type { CommitQuestDatabase } from "../data/database.js";
import {
  commitExists,
  getDailyCommitRewardStats,
  insertCommit,
  markRepositoryScanned
} from "../data/database.js";
import { calculateAwardedXp } from "./xp.js";
import type { GitCommit, RepositoryRecord } from "./types.js";
import { readCommits, readTags } from "../git/git.js";

export interface ScanSummary {
  repositories: number;
  importedCommits: number;
  ignoredCommits: number;
  importedTags: number;
  earnedXp: number;
}

interface PendingCommit {
  repository: RepositoryRecord;
  commit: GitCommit;
}

function dayBounds(value: string): { start: string; end: string } {
  const date = new Date(value);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function scanRepositories(
  db: CommitQuestDatabase,
  repositories: RepositoryRecord[],
  profileEmail: string,
  allAuthors = false
): ScanSummary {
  const pending: PendingCommit[] = [];
  let ignoredCommits = 0;
  let importedTags = 0;
  let earnedXp = 0;

  for (const repository of repositories) {
    const commits = readCommits(repository.path);
    for (const commit of commits) {
      if (commitExists(db, repository.id, commit.hash)) continue;
      if (!allAuthors && profileEmail && commit.authorEmail.toLowerCase() !== profileEmail.toLowerCase()) {
        ignoredCommits += 1;
        continue;
      }
      pending.push({ repository, commit });
    }
  }

  pending.sort((left, right) => new Date(left.commit.authoredAt).getTime() - new Date(right.commit.authoredAt).getTime());

  for (const item of pending) {
    const bounds = dayBounds(item.commit.authoredAt);
    const stats = getDailyCommitRewardStats(db, bounds.start, bounds.end);
    const awardedXp = calculateAwardedXp(item.commit.baseXp, stats.count, stats.xp);
    insertCommit(db, item.repository.id, item.commit, awardedXp);
    earnedXp += awardedXp;
  }

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags(repository_id, name, commit_hash, tagged_at, xp, imported_at)
    VALUES (?, ?, ?, ?, 150, ?)
  `);

  for (const repository of repositories) {
    for (const tag of readTags(repository.path)) {
      const result = insertTag.run(
        repository.id,
        tag.name,
        tag.commitHash,
        tag.taggedAt,
        new Date().toISOString()
      );
      if (result.changes > 0) {
        importedTags += 1;
        earnedXp += 150;
      }
    }
    markRepositoryScanned(db, repository.id);
  }

  return {
    repositories: repositories.length,
    importedCommits: pending.length,
    ignoredCommits,
    importedTags,
    earnedXp
  };
}
