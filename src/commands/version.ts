import fs from "node:fs";
import { APP_VERSION, RELEASE_CHANNEL } from "../version.js";
import { DATABASE_SCHEMA_VERSION, getMeta, openDatabase } from "../data/database.js";
import { getDatabasePath } from "../data/paths.js";
import { loadTuiPreferences } from "../tui/preferences.js";
import { selectedClassTitle } from "../core/classes.js";

export function verboseVersionCommand(): void {
  const db = openDatabase();
  try {
    const settings = loadTuiPreferences();
    console.log(`CommitQuest ${APP_VERSION}`);
    console.log(`Release channel: ${RELEASE_CHANNEL}`);
    console.log(`Executable: ${process.argv[1] ?? "unknown"}`);
    console.log(`Database: ${getDatabasePath()}${fs.existsSync(getDatabasePath()) ? "" : " (missing)"}`);
    console.log(`Database schema: ${DATABASE_SCHEMA_VERSION}`);
    console.log(`Node runtime: ${process.version}`);
    console.log(`Theme: ${settings.theme}`);
    console.log(`Class title: ${selectedClassTitle(db)}`);
    console.log(`Last repair: ${getMeta(db, "doctor.last-repair") ?? "never"}`);
  } finally {
    db.close();
  }
}
