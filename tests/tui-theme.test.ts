import { describe, expect, it } from "vitest";
import { getTuiTheme, TUI_THEMES } from "../src/tui/theme.js";

const EXPECTED_THEME_IDS = [
  "tokyo-night",
  "arcane",
  "catppuccin",
  "everforest",
  "matrix",
  "nord",
  "rose-pine",
  "gruvbox-dark",
  "dracula",
  "solarized-dark",
  "monochrome",
  "obsidian-ink",
  "synthwave",
  "amber-terminal",
  "iceberg",
  "cyberdeck"
] as const;

describe("TUI theme system", () => {
  it("ships the complete curated theme library with unique identifiers", () => {
    const ids = TUI_THEMES.map((theme) => theme.id);
    expect(ids).toEqual(EXPECTED_THEME_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("defines every semantic colour inside every selected palette", () => {
    const semanticKeys = [
      "background", "surface", "surfaceAlt", "text", "muted", "accent",
      "accentAlt", "success", "warning", "danger", "border"
    ] as const;
    for (const theme of TUI_THEMES) {
      for (const key of semanticKeys) {
        expect(theme[key], `${theme.id}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("keeps semantic states theme-specific instead of injecting global colours", () => {
    const matrix = getTuiTheme("matrix");
    const catppuccin = getTuiTheme("catppuccin");
    const monochrome = getTuiTheme("monochrome");

    expect(matrix.danger).toBe("#54b86f");
    expect(matrix.warning).toBe("#b7e85b");
    expect(catppuccin.danger).toBe("#f38ba8");
    expect(catppuccin.warning).toBe("#f9e2af");
    expect(monochrome.danger).toBe("#ffffff");
    expect(new Set([matrix.danger, catppuccin.danger, monochrome.danger]).size).toBe(3);
  });
});
