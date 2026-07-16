import readline, { type Key } from "node:readline";
import { loadTuiModel } from "./model.js";
import {
  clampTuiState,
  initialTuiState,
  transitionTui,
  type TuiKey
} from "./navigation.js";
import { loadTuiPreferences, saveTuiPreferences } from "./preferences.js";
import { renderTui } from "./render.js";
import { getTuiTheme, TUI_THEMES, type TuiTheme } from "./theme.js";
import type { TerminalSize, TuiModel, TuiState } from "./types.js";

interface TuiStreams {
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

const ENTER_ALT_SCREEN = "\x1b[?1049h";
const LEAVE_ALT_SCREEN = "\x1b[?1049l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const DISABLE_WRAP = "\x1b[?7l";
const ENABLE_WRAP = "\x1b[?7h";
const CLEAR_SCREEN = "\x1b[2J\x1b[H";

export function shouldUseInteractiveTui(
  inputIsTty = Boolean(process.stdin.isTTY),
  outputIsTty = Boolean(process.stdout.isTTY),
  term = process.env.TERM
): boolean {
  return inputIsTty && outputIsTty && term !== "dumb";
}

export function keyFromPress(sequence: string | undefined, key: Key | undefined): TuiKey {
  if (key?.ctrl && key.name === "c") return "quit";
  if (key?.name === "up" || sequence === "k" || sequence === "K") return "up";
  if (key?.name === "down" || sequence === "j" || sequence === "J") return "down";
  if (key?.name === "left" || sequence === "h" || sequence === "H") return "left";
  if (key?.name === "right" || sequence === "l" || sequence === "L") return "right";
  if (key?.name === "return" || key?.name === "enter") return "enter";
  if (key?.name === "escape") return "escape";
  if (key?.name === "tab" && key.shift) return "shift-tab";
  if (key?.name === "tab") return "tab";
  if (sequence === "r" || sequence === "R") return "refresh";
  if (sequence === "t" || sequence === "T") return "themes";
  if (sequence === "?") return "help";
  if (sequence === "q" || sequence === "Q") return "quit";
  return "unknown";
}

function terminalSize(output: NodeJS.WriteStream): TerminalSize {
  return {
    width: Math.max(30, output.columns ?? 100),
    height: Math.max(8, output.rows ?? 30)
  };
}

function modelWithError(model: TuiModel, error: unknown): TuiModel {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ...model,
    notice: null,
    warnings: [`Refresh failed: ${message}`, ...model.warnings]
  };
}

function selectedTheme(state: TuiState, fallback: TuiTheme): TuiTheme {
  return TUI_THEMES[state.selected.themes] ?? fallback;
}

export async function launchTui(streams: TuiStreams = {}): Promise<void> {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;
  const preferences = loadTuiPreferences();

  let theme = getTuiTheme(preferences.theme);
  let model = loadTuiModel({ scan: true });
  let state: TuiState = initialTuiState(theme.id);
  let finished = false;
  const rawWasEnabled = Boolean(input.isRaw);

  readline.emitKeypressEvents(input);

  const draw = (): void => {
    output.write(`${CLEAR_SCREEN}${renderTui(model, state, terminalSize(output), {
      color: process.env.NO_COLOR === undefined,
      theme
    })}`);
  };

  const refresh = (): void => {
    try {
      model = loadTuiModel({ scan: true });
      state = clampTuiState(state, model);
    } catch (error) {
      model = modelWithError(model, error);
    }
  };

  const applyTheme = (): void => {
    const nextTheme = selectedTheme(state, theme);
    try {
      saveTuiPreferences({ theme: nextTheme.id });
      theme = nextTheme;
      model = {
        ...model,
        notice: `Theme saved · ${nextTheme.name}`
      };
    } catch (error) {
      model = modelWithError(model, error);
    }
  };

  await new Promise<void>((resolve) => {
    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      input.off("keypress", onKeypress);
      output.off("resize", onResize);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      process.off("uncaughtException", onFatal);
      process.off("unhandledRejection", onFatal);
      if (input.isTTY && !rawWasEnabled) input.setRawMode(false);
      input.pause();
      output.write(`${ENABLE_WRAP}${SHOW_CURSOR}${LEAVE_ALT_SCREEN}`);
      resolve();
    };

    const onSignal = (): void => cleanup();

    const onFatal = (error: unknown): void => {
      cleanup();
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`\nCommitQuest TUI failed: ${message}\n`);
      process.exitCode = 1;
    };

    const onResize = (): void => draw();

    const onKeypress = (sequence: string, key: Key): void => {
      const transition = transitionTui(state, keyFromPress(sequence, key), model);
      state = transition.state;
      if (transition.effect === "quit") {
        cleanup();
        return;
      }
      if (transition.effect === "refresh") refresh();
      if (transition.effect === "apply-theme") applyTheme();
      draw();
    };

    input.on("keypress", onKeypress);
    output.on("resize", onResize);
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("uncaughtException", onFatal);
    process.on("unhandledRejection", onFatal);

    output.write(`${ENTER_ALT_SCREEN}${HIDE_CURSOR}${DISABLE_WRAP}`);
    if (input.isTTY && !rawWasEnabled) input.setRawMode(true);
    input.resume();
    draw();
  });
}
