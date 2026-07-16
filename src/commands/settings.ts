import chalk from "chalk";
import {
  DEFAULT_TUI_PREFERENCES,
  loadTuiPreferences,
  saveTuiPreferences,
  type ColorPreference,
  type MotionPreference
} from "../tui/preferences.js";
import { getTuiTheme, isTuiThemeId, TUI_THEMES } from "../tui/theme.js";
import { getSettingsPath } from "../data/paths.js";

interface SettingsOptions {
  theme?: string;
  motion?: MotionPreference;
  color?: ColorPreference;
  reset?: boolean;
}

export function settingsCommand(options: SettingsOptions = {}): void {
  if (options.reset) {
    saveTuiPreferences({ ...DEFAULT_TUI_PREFERENCES });
  } else {
    const current = loadTuiPreferences();
    if (options.theme && !isTuiThemeId(options.theme)) {
      throw new Error(`Unknown theme “${options.theme}”. Choose: ${TUI_THEMES.map((theme) => theme.id).join(", ")}`);
    }
    saveTuiPreferences({
      theme: options.theme && isTuiThemeId(options.theme) ? options.theme : current.theme,
      motion: options.motion ?? current.motion,
      color: options.color ?? current.color
    });
  }

  const settings = loadTuiPreferences();
  console.log(chalk.bold.magenta("COMMITQUEST SETTINGS\n"));
  console.log(`Theme: ${getTuiTheme(settings.theme).name} (${settings.theme})`);
  console.log(`Motion: ${settings.motion}`);
  console.log(`Colour: ${settings.color}`);
  console.log(`File: ${getSettingsPath()}`);
}
