import chalk from "chalk";
import { createPrivacyAudit, humanBytes } from "../core/privacy.js";

export function privacyCommand(options: { json?: boolean } = {}): void {
  const audit = createPrivacyAudit();
  if (options.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  console.log(chalk.bold.magenta("COMMITQUEST PRIVACY AUDIT\n"));
  console.log(`${chalk.green("◆")} Network access: none`);
  console.log(`${chalk.green("◆")} Default shares hide campaign names, repository paths, email addresses, hashes, and commit subjects`);
  console.log(`${chalk.yellow("◆")} Local database stores repository paths and commit subjects so campaigns and rewards work offline`);
  console.log("");
  console.log(`Campaigns: ${audit.campaigns} (${audit.archivedCampaigns} archived)`);
  console.log(`Database: ${audit.databasePath} · ${humanBytes(audit.databaseBytes)}`);
  console.log(`Backups: ${audit.backups}`);
  console.log(`Crash reports: ${audit.crashReports}`);
  console.log(`Generated shares: ${audit.shares}`);
  console.log(`Data directory: ${audit.dataDirectory}`);
  console.log(`Config directory: ${audit.configDirectory}`);
}
