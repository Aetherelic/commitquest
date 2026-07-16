import chalk from "chalk";
import { createBackup, listBackups, restoreBackup } from "../core/backup.js";
import { APP_VERSION } from "../version.js";

export function backupCreateCommand(): void {
  const backup = createBackup({ appVersion: APP_VERSION });
  console.log(`${chalk.green("◆")} Backup created: ${backup.id}`);
  console.log(`  ${backup.path}`);
}

export function backupListCommand(): void {
  const backups = listBackups();
  if (backups.length === 0) {
    console.log("No CommitQuest backups found.");
    return;
  }
  console.log(chalk.bold("COMMITQUEST BACKUPS\n"));
  for (const backup of backups) {
    console.log(`${chalk.cyan("◆")} ${backup.id}`);
    console.log(`  ${backup.manifest.kind} · ${backup.manifest.createdAt} · integrity ${backup.manifest.databaseIntegrity}`);
  }
}

export function backupRestoreCommand(selector: string, options: { yes?: boolean }): void {
  if (!options.yes) {
    throw new Error("Restoring replaces current CommitQuest data. Re-run with --yes after creating or reviewing a backup.");
  }
  const restored = restoreBackup(selector, { appVersion: APP_VERSION });
  console.log(`${chalk.green("◆")} Restored backup: ${restored.id}`);
}
