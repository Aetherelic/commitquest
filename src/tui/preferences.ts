import fs from "node:fs";
import path from "node:path";
import { getSettingsPath } from "../data/paths.js";
import {
  DEFAULT_THEME_ID,
  isTuiThemeId,
  type TuiThemeId
} from "./theme.js";

interface StoredPreferences {
  theme?: unknown;
}

export interface TuiPreferences {
  theme: TuiThemeId;
}

export function loadTuiPreferences(settingsPath = getSettingsPath()): TuiPreferences {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as StoredPreferences;
    return {
      theme: isTuiThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME_ID
    };
  } catch {
    return { theme: DEFAULT_THEME_ID };
  }
}

export function saveTuiPreferences(
  preferences: TuiPreferences,
  settingsPath = getSettingsPath()
): void {
  const directory = path.dirname(settingsPath);
  const temporaryPath = `${settingsPath}.${process.pid}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  fs.renameSync(temporaryPath, settingsPath);
}
