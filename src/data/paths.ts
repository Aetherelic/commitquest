import os from "node:os";
import path from "node:path";

export function getDataDirectory(): string {
  const override = process.env.COMMITQUEST_HOME;
  if (override) return path.resolve(override);

  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) return path.join(xdgDataHome, "commitquest");

  return path.join(os.homedir(), ".local", "share", "commitquest");
}

export function getConfigDirectory(): string {
  const override = process.env.COMMITQUEST_HOME;
  if (override) return path.resolve(override);

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) return path.join(xdgConfigHome, "commitquest");

  return path.join(os.homedir(), ".config", "commitquest");
}

export function getDatabasePath(): string {
  return path.join(getDataDirectory(), "commitquest.db");
}

export function getSettingsPath(): string {
  return path.join(getConfigDirectory(), "settings.json");
}

export function getBackupDirectory(): string {
  return path.join(getDataDirectory(), "backups");
}

export function getCrashDirectory(): string {
  return path.join(getDataDirectory(), "crash-reports");
}

export function getShareDirectory(): string {
  return path.join(getDataDirectory(), "shares");
}
