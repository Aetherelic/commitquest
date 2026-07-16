import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getCrashDirectory } from "../data/paths.js";

export function writeCrashReport(error: unknown, context: Record<string, unknown> = {}): string {
  const directory = getCrashDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const now = new Date();
  const filename = `crash-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  const destination = path.join(directory, filename);
  const value = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack ?? null }
    : { name: "UnknownError", message: String(error), stack: null };
  fs.writeFileSync(destination, `${JSON.stringify({
    createdAt: now.toISOString(),
    error: value,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname()
    },
    context
  }, null, 2)}\n`, { mode: 0o600 });
  return destination;
}
