import path from "node:path";
import chalk from "chalk";
import { applyCleanupPlan, createCleanupPlan } from "../core/cleanup.js";

interface CleanupOptions {
  apply?: boolean;
  keepBackups?: string;
  keepCrashes?: string;
}

function parseCount(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
}

export function cleanupCommand(options: CleanupOptions = {}): void {
  const plan = createCleanupPlan({
    keepBackups: parseCount(options.keepBackups, 10, "--keep-backups"),
    keepCrashReports: parseCount(options.keepCrashes, 20, "--keep-crashes")
  });

  console.log(chalk.bold.magenta(`COMMITQUEST CLEANUP${options.apply ? " · APPLY" : " · PREVIEW"}\n`));
  if (plan.candidates.length === 0) {
    console.log(`${chalk.green("◆")} Nothing needs cleaning.`);
    return;
  }

  for (const candidate of plan.candidates) {
    console.log(`${options.apply ? chalk.green("◆") : chalk.yellow("◇")} ${candidate.kind}: ${path.basename(candidate.path)}`);
  }

  if (options.apply) {
    applyCleanupPlan(plan);
    console.log(`\nRemoved ${plan.candidates.length} old item${plan.candidates.length === 1 ? "" : "s"}.`);
  } else {
    console.log("\nPreview only. Re-run with --apply to remove these files.");
  }
}
