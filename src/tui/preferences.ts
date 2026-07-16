import fs from "node:fs";
import path from "node:path";
import { getSettingsPath } from "../data/paths.js";
import {
  DEFAULT_THEME_ID,
  isTuiThemeId,
  type TuiThemeId
} from "./theme.js";

export type MotionPreference = "full" | "reduced";
export type ColorPreference = "auto" | "always" | "never";

interface StoredPreferences {
  theme?: unknown;
  motion?: unknown;
  color?: unknown;
}

export interface TuiPreferences {
  theme: TuiThemeId;
  motion: MotionPreference;
  color: ColorPreference;
}

export const DEFAULT_TUI_PREFERENCES: TuiPreferences = {
  theme: DEFAULT_THEME_ID,
  motion: "full",
  color: "auto"
};

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === "full" || value === "reduced";
}

function isColorPreference(value: unknown): value is ColorPreference {
  return value === "auto" || value === "always" || value === "never";
}

export function loadTuiPreferences(settingsPath = getSettingsPath()): TuiPreferences {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as StoredPreferences;
    return {
      theme: isTuiThemeId(parsed.theme) ? parsed.theme : DEFAULT_TUI_PREFERENCES.theme,
      motion: isMotionPreference(parsed.motion) ? parsed.motion : DEFAULT_TUI_PREFERENCES.motion,
      color: isColorPreference(parsed.color) ? parsed.color : DEFAULT_TUI_PREFERENCES.color
    };
  } catch {
    return { ...DEFAULT_TUI_PREFERENCES };
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

export function shouldUseColor(preferences: TuiPreferences, noColor = process.env.NO_COLOR): boolean {
  if (preferences.color === "always") return true;
  if (preferences.color === "never") return false;
  return noColor === undefined;
}
