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
  historicalCommits: number;
  historicalTags: number;
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
  let historicalCommits = 0;
  let historicalTags = 0;
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
    const questEligible = new Date(item.commit.authoredAt).getTime() >= new Date(item.repository.addedAt).getTime();
    insertCommit(db, item.repository.id, item.commit, awardedXp, questEligible);
    if (!questEligible) historicalCommits += 1;
    earnedXp += awardedXp;
  }

  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO tags(
      repository_id, name, commit_hash, tagged_at, xp, imported_at, quest_eligible
    ) VALUES (?, ?, ?, ?, 150, ?, ?)
  `);

  for (const repository of repositories) {
    for (const tag of readTags(repository.path)) {
      const questEligible = new Date(tag.taggedAt).getTime() >= new Date(repository.addedAt).getTime();
      const result = insertTag.run(
        repository.id,
        tag.name,
        tag.commitHash,
        tag.taggedAt,
        new Date().toISOString(),
        questEligible ? 1 : 0
      );
      if (result.changes > 0) {
        importedTags += 1;
        if (!questEligible) historicalTags += 1;
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
    historicalCommits,
    historicalTags,
    earnedXp
  };
}
