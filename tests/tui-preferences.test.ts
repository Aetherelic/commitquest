import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TUI_PREFERENCES,
  loadTuiPreferences,
  saveTuiPreferences,
  shouldUseColor
} from "../src/tui/preferences.js";

const temporaryDirectories: string[] = [];

function settingsPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-theme-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "nested", "settings.json");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("TUI preferences", () => {
  it("uses stable defaults when settings are missing or invalid", () => {
    const missing = settingsPath();
    expect(loadTuiPreferences(missing)).toEqual(DEFAULT_TUI_PREFERENCES);

    fs.mkdirSync(path.dirname(missing), { recursive: true });
    fs.writeFileSync(missing, '{"theme":"not-a-theme","motion":"fast","color":"rainbow"}\n');
    expect(loadTuiPreferences(missing)).toEqual(DEFAULT_TUI_PREFERENCES);

    fs.writeFileSync(missing, "not json");
    expect(loadTuiPreferences(missing)).toEqual(DEFAULT_TUI_PREFERENCES);
  });

  it("persists theme, motion, and colour atomically", () => {
    const file = settingsPath();
    const preferences = { theme: "arcane", motion: "reduced", color: "never" } as const;
    saveTuiPreferences(preferences, file);

    expect(loadTuiPreferences(file)).toEqual(preferences);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(preferences);
    expect(fs.readdirSync(path.dirname(file))).toEqual(["settings.json"]);
  });

  it("respects explicit colour settings and NO_COLOR", () => {
    expect(shouldUseColor({ ...DEFAULT_TUI_PREFERENCES, color: "always" }, "1")).toBe(true);
    expect(shouldUseColor({ ...DEFAULT_TUI_PREFERENCES, color: "never" }, undefined)).toBe(false);
    expect(shouldUseColor({ ...DEFAULT_TUI_PREFERENCES, color: "auto" }, "1")).toBe(false);
    expect(shouldUseColor({ ...DEFAULT_TUI_PREFERENCES, color: "auto" }, undefined)).toBe(true);
  });
});
