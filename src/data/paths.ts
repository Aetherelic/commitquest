import os from "node:os";
import path from "node:path";

export function getDataDirectory(): string {
  const override = process.env.COMMITQUEST_HOME;
  if (override) return path.resolve(override);

  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) return path.join(xdgDataHome, "commitquest");

  return path.join(os.homedir(), ".local", "share", "commitquest");
}

export function getDatabasePath(): string {
  return path.join(getDataDirectory(), "commitquest.db");
}
