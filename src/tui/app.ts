import readline, { type Key } from "node:readline";
import {
  availablePaletteEntries,
  executeConfirmedAction,
  executeFormOverlay,
  executeImmediateAction,
  filteredPaletteEntries,
  onboardingCampaignForm,
  onboardingProfileForm,
  onboardingThemeForm,
  openTuiAction
} from "./actions.js";
import { acknowledgeTuiRewards, loadTuiModel } from "./model.js";
import {
  clampTuiState,
  initialTuiState,
  transitionTui,
  type TuiEffect,
  type TuiKey
} from "./navigation.js";
import { loadTuiPreferences, saveTuiPreferences, shouldUseColor } from "./preferences.js";
import { renderTui } from "./render.js";
import { getTuiTheme, TUI_THEMES, type TuiTheme } from "./theme.js";
import { writeCrashReport } from "../core/crash.js";
import type {
  TerminalSize,
  TuiActionId,
  TuiConfirmOverlay,
  TuiFormField,
  TuiFormOverlay,
  TuiModel,
  TuiState
} from "./types.js";

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
  if (key?.name === "backspace") return "backspace";
  if (key?.name === "delete") return "delete";
  if (key?.name === "tab" && key.shift) return "shift-tab";
  if (key?.name === "tab") return "tab";
  if (sequence === "/") return "palette";
  if (sequence === "r" || sequence === "R") return "refresh";
  if (sequence === "t" || sequence === "T") return "themes";
  if (sequence === "m" || sequence === "M") return "motion";
  if (sequence === "v" || sequence === "V") return "color";
  if (sequence === "n" || sequence === "N") return "new";
  if (sequence === "e" || sequence === "E") return "edit";
  if (sequence === "c" || sequence === "C") return "complete";
  if (sequence === "a" || sequence === "A") return "abandon";
  if (sequence === "s" || sequence === "S") return "scan";
  if (sequence === "p" || sequence === "P") return "repair";
  if (sequence === "x" || sequence === "X") return "archive";
  if (sequence === "d" || sequence === "D") return "remove";
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
  return { ...model, notice: null, warnings: [`Action failed: ${message}`, ...model.warnings] };
}

function selectedTheme(state: TuiState, fallback: TuiTheme): TuiTheme {
  return TUI_THEMES[state.selected.themes] ?? fallback;
}

function wrap(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

function visibleFieldIndexes(form: TuiFormOverlay): number[] {
  return form.fields.map((field, index) => ({ field, index })).filter(({ field }) => !field.secret).map(({ index }) => index);
}

function activeField(form: TuiFormOverlay): { field: TuiFormField; index: number; visiblePosition: number } | null {
  const visible = visibleFieldIndexes(form);
  if (visible.length === 0) return null;
  const visiblePosition = Math.max(0, Math.min(form.fieldIndex, visible.length - 1));
  const index = visible[visiblePosition]!;
  return { field: form.fields[index]!, index, visiblePosition };
}

function mutateField(form: TuiFormOverlay, index: number, value: string): TuiFormOverlay {
  return {
    ...form,
    error: null,
    fields: form.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, value } : field)
  };
}

function cycleField(form: TuiFormOverlay, direction: number): TuiFormOverlay {
  const current = activeField(form);
  if (!current) return form;
  const field = current.field;
  if (field.kind === "boolean") return mutateField(form, current.index, field.value === "true" ? "false" : "true");
  if (field.kind !== "choice" || !field.choices?.length) return form;
  const currentIndex = Math.max(0, field.choices.findIndex((choice) => choice.value === field.value));
  const next = field.choices[wrap(currentIndex + direction, field.choices.length)]!;
  return mutateField(form, current.index, next.value);
}

function moveFormField(form: TuiFormOverlay, direction: number): TuiFormOverlay {
  const count = visibleFieldIndexes(form).length;
  return { ...form, fieldIndex: wrap(form.fieldIndex + direction, count), error: null };
}

function printableInput(sequence: string, key: Key): string | null {
  if (key.ctrl || key.meta || sequence.length !== 1) return null;
  const code = sequence.codePointAt(0) ?? 0;
  return code >= 32 && code !== 127 ? sequence : null;
}

export async function launchTui(streams: TuiStreams = {}): Promise<void> {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;
  const preferences = loadTuiPreferences();

  let theme = getTuiTheme(preferences.theme);
  let model = loadTuiModel({ scan: true });
  let state: TuiState = initialTuiState(theme.id, Boolean(model.rewardModal), model.onboardingRequired);
  let finished = false;
  let pulse = false;
  const rawWasEnabled = Boolean(input.isRaw);

  readline.emitKeypressEvents(input);

  const draw = (): void => {
    output.write(`${CLEAR_SCREEN}${renderTui(model, state, terminalSize(output), {
      color: shouldUseColor(preferences),
      theme,
      pulse,
      motion: preferences.motion,
      colorMode: preferences.color
    })}`);
  };

  const reload = (options: { scan?: boolean; notice?: string } = {}): void => {
    try {
      const next = loadTuiModel(options.scan === undefined ? {} : { scan: options.scan });
      model = options.notice ? { ...next, notice: options.notice } : next;
      state = { ...clampTuiState(state, model), modalOpen: Boolean(model.rewardModal) && !state.overlay };
    } catch (error) {
      model = modelWithError(model, error);
    }
  };

  const applyTheme = (nextTheme = selectedTheme(state, theme)): void => {
    try {
      preferences.theme = nextTheme.id;
      saveTuiPreferences(preferences);
      theme = nextTheme;
      model = { ...model, notice: `Theme saved · ${nextTheme.name}` };
    } catch (error) {
      model = modelWithError(model, error);
    }
  };

  const showError = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    if (state.overlay?.kind === "form") {
      state = { ...state, overlay: { ...state.overlay, error: message } };
    } else if (state.overlay?.kind === "confirm") {
      state = { ...state, overlay: { ...state.overlay, error: message } };
    } else {
      state = {
        ...state,
        overlay: { kind: "notice", title: "Action Failed", lines: [message], tone: "danger" }
      };
    }
  };

  const applyActionResult = (result: ReturnType<typeof executeFormOverlay>): void => {
    if (result.themeId) {
      const nextTheme = getTuiTheme(result.themeId);
      applyTheme(nextTheme);
    }
    reload(result.scan === undefined ? { notice: result.notice } : { scan: result.scan, notice: result.notice });
    if (result.onboardingNext === "campaign") {
      state = { ...state, overlay: onboardingCampaignForm() };
    } else if (result.onboardingNext === "theme") {
      state = { ...state, overlay: onboardingThemeForm(theme.id) };
    } else if (result.onboardingNext === "complete") {
      state = { ...state, overlay: { kind: "onboarding", step: "complete" } };
    } else {
      state = { ...state, overlay: null, modalOpen: Boolean(model.rewardModal) };
    }
  };

  const executeAction = (action: TuiActionId): void => {
    try {
      if (action === "refresh-all" || action === "campaign-scan" || action === "class-choose" || action === "share-export") {
        const result = executeImmediateAction(action, model, state);
        reload(result.scan === undefined ? { notice: result.notice } : { scan: result.scan, notice: result.notice });
        state = { ...state, overlay: null, modalOpen: Boolean(model.rewardModal) };
        return;
      }
      state = openTuiAction(state, action, model);
    } catch (error) {
      showError(error);
    }
  };

  const submitForm = (form: TuiFormOverlay): void => {
    try {
      applyActionResult(executeFormOverlay(form, model));
    } catch (error) {
      showError(error);
    }
  };

  const submitConfirmation = (confirm: TuiConfirmOverlay): void => {
    if (confirm.verification && confirm.typed !== confirm.verification) {
      state = { ...state, overlay: { ...confirm, error: `Type “${confirm.verification}” exactly to continue.` } };
      return;
    }
    try {
      const result = executeConfirmedAction(confirm.action, model, state);
      reload({ notice: result.notice });
      state = { ...state, overlay: null, modalOpen: Boolean(model.rewardModal) };
    } catch (error) {
      showError(error);
    }
  };

  const handleOverlayKey = (sequence: string, key: Key): boolean => {
    const overlay = state.overlay;
    if (!overlay) return false;
    const mapped = keyFromPress(sequence, key);

    if (key.ctrl && key.name === "c") return false;

    if (overlay.kind === "onboarding") {
      if (mapped === "enter") {
        state = overlay.step === "welcome"
          ? { ...state, overlay: onboardingProfileForm(model) }
          : { ...state, overlay: null };
      }
      return true;
    }

    if (overlay.kind === "notice" || overlay.kind === "detail") {
      if (mapped === "enter" || mapped === "escape") state = { ...state, overlay: null };
      return true;
    }

    if (overlay.kind === "palette") {
      const entries = filteredPaletteEntries(model, state);
      if (mapped === "escape") {
        state = { ...state, overlay: null };
      } else if (mapped === "up" || mapped === "down") {
        state = { ...state, overlay: { ...overlay, selected: wrap(overlay.selected + (mapped === "up" ? -1 : 1), entries.length) } };
      } else if (mapped === "backspace") {
        state = { ...state, overlay: { ...overlay, query: overlay.query.slice(0, -1), selected: 0 } };
      } else if (mapped === "enter") {
        const entry = entries[overlay.selected];
        if (entry?.enabled) {
          state = { ...state, overlay: null };
          executeAction(entry.id);
        }
      } else {
        const printable = printableInput(sequence, key);
        if (printable) state = { ...state, overlay: { ...overlay, query: overlay.query + printable, selected: 0 } };
      }
      return true;
    }

    if (overlay.kind === "confirm") {
      if (mapped === "escape") {
        state = { ...state, overlay: null };
      } else if (mapped === "enter") {
        submitConfirmation(overlay);
      } else if (mapped === "backspace" && overlay.verification) {
        state = { ...state, overlay: { ...overlay, typed: overlay.typed.slice(0, -1), error: null } };
      } else if (overlay.verification) {
        const printable = printableInput(sequence, key);
        if (printable) state = { ...state, overlay: { ...overlay, typed: overlay.typed + printable, error: null } };
      }
      return true;
    }

    if (overlay.kind === "form") {
      const current = activeField(overlay);
      if (mapped === "escape") {
        if (overlay.action === "onboarding-campaign" && overlay.allowSkip) {
          state = { ...state, overlay: onboardingThemeForm(theme.id) };
        } else if (overlay.action === "onboarding-theme") {
          state = { ...state, overlay: onboardingCampaignForm() };
        } else if (overlay.action === "onboarding-profile") {
          state = { ...state, overlay: { kind: "onboarding", step: "welcome" } };
        } else {
          state = { ...state, overlay: null };
        }
      } else if (mapped === "up" || mapped === "shift-tab") {
        state = { ...state, overlay: moveFormField(overlay, -1) };
      } else if (mapped === "down" || mapped === "tab") {
        state = { ...state, overlay: moveFormField(overlay, 1) };
      } else if (mapped === "left" || mapped === "right") {
        state = { ...state, overlay: cycleField(overlay, mapped === "left" ? -1 : 1) };
      } else if (mapped === "backspace" && current && (current.field.kind === "text" || current.field.kind === "number")) {
        state = { ...state, overlay: mutateField(overlay, current.index, current.field.value.slice(0, -1)) };
      } else if (mapped === "enter") {
        const visible = visibleFieldIndexes(overlay);
        if (overlay.fieldIndex < visible.length - 1) state = { ...state, overlay: moveFormField(overlay, 1) };
        else submitForm(overlay);
      } else if (current && (current.field.kind === "text" || current.field.kind === "number")) {
        const printable = printableInput(sequence, key);
        if (printable && (current.field.kind !== "number" || /[0-9]/.test(printable))) {
          state = { ...state, overlay: mutateField(overlay, current.index, current.field.value + printable) };
        }
      } else if (current && current.field.kind === "boolean" && sequence === " ") {
        state = { ...state, overlay: cycleField(overlay, 1) };
      }
      return true;
    }

    return true;
  };

  await new Promise<void>((resolve) => {
    const animation = setInterval(() => {
      if (preferences.motion === "reduced") return;
      if (finished || state.screen !== "home" || state.helpOpen || state.modalOpen || state.overlay) return;
      pulse = !pulse;
      draw();
    }, 650);

    const cleanup = (): void => {
      if (finished) return;
      finished = true;
      input.off("keypress", onKeypress);
      output.off("resize", onResize);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      process.off("uncaughtException", onFatal);
      process.off("unhandledRejection", onFatal);
      clearInterval(animation);
      if (input.isTTY && !rawWasEnabled) input.setRawMode(false);
      input.pause();
      output.write(`${ENABLE_WRAP}${SHOW_CURSOR}${LEAVE_ALT_SCREEN}`);
      resolve();
    };

    const onSignal = (): void => cleanup();
    const onFatal = (error: unknown): void => {
      cleanup();
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      const report = writeCrashReport(error, { screen: state.screen, overlay: state.overlay?.kind ?? null });
      process.stderr.write(`\nCommitQuest TUI failed: ${message}\nCrash report: ${report}\n`);
      process.exitCode = 1;
    };
    const onResize = (): void => draw();

    const processEffect = (effect: TuiEffect): void => {
      if (effect === "refresh") reload({ scan: true });
      if (effect === "apply-theme") applyTheme();
      if (effect === "ack-rewards" && model.rewardModal) {
        acknowledgeTuiRewards(model.rewardModal.seenThrough);
        model = { ...model, rewardModal: null };
      }
      if (effect === "open-palette") state = { ...state, overlay: { kind: "palette", query: "", selected: 0 } };
      if (effect === "open-detail") executeAction("show-detail");
      if (effect === "quest-create") executeAction("quest-create");
      if (effect === "quest-edit") executeAction("quest-edit");
      if (effect === "quest-complete") executeAction("quest-complete");
      if (effect === "quest-abandon") executeAction("quest-abandon");
      if (effect === "campaign-add") executeAction("campaign-add");
      if (effect === "campaign-scan") executeAction("campaign-scan");
      if (effect === "campaign-repair") executeAction("campaign-repair");
      if (effect === "campaign-archive-toggle") {
        const campaign = model.campaigns[state.selected.campaigns];
        executeAction(campaign?.archived ? "campaign-restore" : "campaign-archive");
      }
      if (effect === "campaign-remove") executeAction("campaign-remove");
      if (effect === "class-choose") executeAction("class-choose");
      if (effect === "share-export") executeAction("share-export");
      if (effect === "toggle-motion") {
        preferences.motion = preferences.motion === "full" ? "reduced" : "full";
        saveTuiPreferences(preferences);
        model = { ...model, notice: `Motion set to ${preferences.motion}` };
      }
      if (effect === "cycle-color") {
        const modes = ["auto", "always", "never"] as const;
        const current = Math.max(0, modes.indexOf(preferences.color));
        preferences.color = modes[(current + 1) % modes.length] ?? "auto";
        saveTuiPreferences(preferences);
        model = { ...model, notice: `Colour set to ${preferences.color}` };
      }
    };

    const onKeypress = (sequence: string, key: Key): void => {
      if (handleOverlayKey(sequence, key)) {
        draw();
        return;
      }
      const transition = transitionTui(state, keyFromPress(sequence, key), model);
      state = transition.state;
      if (transition.effect === "quit") {
        cleanup();
        return;
      }
      processEffect(transition.effect);
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
