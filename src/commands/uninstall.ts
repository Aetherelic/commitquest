import chalk from "chalk";
import { detectLocalInstallation, uninstallLocalInstallation } from "../core/uninstall.js";

interface UninstallOptions {
  yes?: boolean;
  purgeData?: boolean;
}

export function uninstallCommand(options: UninstallOptions = {}): void {
  if (!options.yes) {
    throw new Error("Uninstall requires --yes. Data is preserved unless --purge-data is also supplied.");
  }
  const installation = detectLocalInstallation();
  if (!installation) {
    throw new Error("This does not appear to be a local npm installation. Nix users should run `nix profile remove commitquest`.");
  }
  const result = uninstallLocalInstallation(installation, { purgeData: options.purgeData ?? false });
  console.log(chalk.bold.magenta("COMMITQUEST UNINSTALLED\n"));
  console.log(`${chalk.green("◆")} Removed application from ${installation.prefix}`);
  if (result.removedData) {
    console.log(`${chalk.yellow("◆")} Removed CommitQuest data and settings`);
  } else {
    console.log(`${chalk.green("◆")} Preserved data: ${result.preservedDataDirectory}`);
    console.log(`${chalk.green("◆")} Preserved settings: ${result.preservedConfigDirectory}`);
  }
}
