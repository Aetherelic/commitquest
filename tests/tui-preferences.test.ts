import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTuiPreferences, saveTuiPreferences } from "../src/tui/preferences.js";
import { DEFAULT_THEME_ID } from "../src/tui/theme.js";

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

describe("TUI theme preferences", () => {
  it("uses Tokyo Night when settings are missing or invalid", () => {
    const missing = settingsPath();
    expect(loadTuiPreferences(missing).theme).toBe(DEFAULT_THEME_ID);

    fs.mkdirSync(path.dirname(missing), { recursive: true });
    fs.writeFileSync(missing, '{"theme":"not-a-theme"}\n');
    expect(loadTuiPreferences(missing).theme).toBe(DEFAULT_THEME_ID);

    fs.writeFileSync(missing, "not json");
    expect(loadTuiPreferences(missing).theme).toBe(DEFAULT_THEME_ID);
  });

  it("persists a selected theme atomically", () => {
    const file = settingsPath();
    saveTuiPreferences({ theme: "arcane" }, file);

    expect(loadTuiPreferences(file)).toEqual({ theme: "arcane" });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ theme: "arcane" });
    expect(fs.readdirSync(path.dirname(file))).toEqual(["settings.json"]);
  });
});
