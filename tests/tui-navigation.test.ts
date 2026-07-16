import { describe, expect, it } from "vitest";
import type { Key } from "node:readline";
import { keyFromPress, shouldUseInteractiveTui } from "../src/tui/app.js";
import {
  HOME_MENU,
  initialTuiState,
  transitionTui
} from "../src/tui/navigation.js";
import type { TuiModel } from "../src/tui/types.js";

function model(): TuiModel {
  return {
    profile: { name: "Aetherelic", email: "developer@example.com" },
    level: {
      level: 3,
      title: "Code Explorer",
      currentLevelXp: 275,
      nextLevelXp: 525,
      xpIntoLevel: 120,
      xpNeeded: 250,
      percentage: 48
    },
    totalXp: 395,
    streak: { current: 2, longest: 4 },
    stats: { commits: 5, repositories: 2, releases: 0, questRewards: 1, achievements: 1 },
    quests: [{
      key: "daily",
      title: "First Step",
      description: "Make one commit.",
      progress: 0,
      target: 1,
      rewardXp: 25,
      complete: false,
      periodLabel: "Daily"
    }],
    rewardedQuestKeys: new Set(),
    customQuests: [],
    achievements: [{
      key: "first",
      title: "The Quest Begins",
      description: "Import your first commit.",
      rewardXp: 50,
      unlocked: true,
      unlockedAt: "2026-07-16T12:00:00.000Z"
    }],
    campaigns: [{
      id: 1,
      name: "commitquest",
      path: "/tmp/commitquest",
      defaultBranch: "main",
      addedAt: "2026-07-16T10:00:00.000Z",
      lastScannedAt: "2026-07-16T12:00:00.000Z",
      archived: false,
      commits: 5,
      releases: 0,
      earnedXp: 220,
      lastActivityAt: "2026-07-16T11:00:00.000Z"
    }],
    recentActivity: [{
      kind: "commit",
      repositoryName: "commitquest",
      occurredAt: "2026-07-16T11:00:00.000Z",
      subject: "feat: add terminal dashboard",
      type: "feat",
      awardedXp: 55,
      reference: "abcdef123456"
    }],
    commitTypes: [{ type: "feat", count: 3, xp: 150 }],
    dailyXp: [{ date: "2026-07-16", xp: 220 }],
    rewardModal: null,
    notice: null,
    warnings: [],
    refreshedAt: "2026-07-16T12:00:00.000Z",
    onboardingRequired: false
  };
}

describe("TUI keyboard mapping", () => {
  const key = (name: string, extra: Partial<Key> = {}): Key => ({ name, ...extra });

  it.each([
    ["j", undefined, "down"],
    ["k", undefined, "up"],
    ["h", undefined, "left"],
    ["l", undefined, "right"],
    ["r", undefined, "refresh"],
    ["t", undefined, "themes"],
    ["/", undefined, "palette"],
    ["n", undefined, "new"],
    ["e", undefined, "edit"],
    ["c", undefined, "complete"],
    ["a", undefined, "abandon"],
    ["s", undefined, "scan"],
    ["p", undefined, "repair"],
    ["x", undefined, "archive"],
    ["d", undefined, "remove"],
    ["?", undefined, "help"],
    ["q", undefined, "quit"],
    ["", key("up"), "up"],
    ["", key("down"), "down"],
    ["", key("left"), "left"],
    ["", key("right"), "right"],
    ["", key("return"), "enter"],
    ["", key("escape"), "escape"],
    ["", key("tab"), "tab"],
    ["", key("tab", { shift: true }), "shift-tab"],
    ["", key("c", { ctrl: true }), "quit"]
  ] as const)("maps %s/%s to %s", (sequence, inputKey, expected) => {
    expect(keyFromPress(sequence, inputKey)).toBe(expected);
  });

  it("only enables the full-screen app in a usable TTY", () => {
    expect(shouldUseInteractiveTui(true, true, "xterm-256color")).toBe(true);
    expect(shouldUseInteractiveTui(false, true, "xterm-256color")).toBe(false);
    expect(shouldUseInteractiveTui(true, false, "xterm-256color")).toBe(false);
    expect(shouldUseInteractiveTui(true, true, "dumb")).toBe(false);
  });
});

describe("TUI navigation", () => {
  it("moves through the home menu, opens a screen, and returns home", () => {
    const data = model();
    let state = initialTuiState();
    state = transitionTui(state, "down", data).state;
    expect(state.homeIndex).toBe(1);

    state = transitionTui(state, "enter", data).state;
    expect(state.screen).toBe(HOME_MENU[1]?.screen);

    state = transitionTui(state, "escape", data).state;
    expect(state.screen).toBe("home");
  });

  it("wraps list selections and cycles screens in both directions", () => {
    const data = model();
    let state = initialTuiState();
    state = transitionTui(state, "up", data).state;
    expect(state.homeIndex).toBe(HOME_MENU.length - 1);

    state = transitionTui(state, "tab", data).state;
    expect(state.screen).toBe("quests");
    state = transitionTui(state, "shift-tab", data).state;
    expect(state.screen).toBe("home");
    state = transitionTui(state, "left", data).state;
    expect(state.screen).toBe("themes");
  });

  it("opens and closes help without losing the current screen", () => {
    const data = model();
    let state = { ...initialTuiState(), screen: "campaigns" as const };
    state = transitionTui(state, "help", data).state;
    expect(state.helpOpen).toBe(true);
    state = transitionTui(state, "escape", data).state;
    expect(state.helpOpen).toBe(false);
    expect(state.screen).toBe("campaigns");
  });

  it("opens themes directly and emits an apply effect", () => {
    const data = model();
    let state = initialTuiState();
    state = transitionTui(state, "themes", data).state;
    expect(state.screen).toBe("themes");
    state = transitionTui(state, "down", data).state;
    expect(state.selected.themes).toBe(1);
    expect(transitionTui(state, "enter", data).effect).toBe("apply-theme");
  });

  it("emits refresh and quit effects", () => {
    const data = model();
    const state = initialTuiState();
    expect(transitionTui(state, "refresh", data).effect).toBe("refresh");
    expect(transitionTui(state, "quit", data).effect).toBe("quit");
  });

  it("emits contextual action effects and opens onboarding safely", () => {
    const data = model();
    const questState = { ...initialTuiState(), screen: "quests" as const };
    expect(transitionTui(questState, "new", data).effect).toBe("quest-create");
    expect(transitionTui(questState, "edit", data).effect).toBe("quest-edit");
    expect(transitionTui(questState, "complete", data).effect).toBe("quest-complete");
    expect(transitionTui(questState, "abandon", data).effect).toBe("quest-abandon");

    const campaignState = { ...initialTuiState(), screen: "campaigns" as const };
    expect(transitionTui(campaignState, "new", data).effect).toBe("campaign-add");
    expect(transitionTui(campaignState, "scan", data).effect).toBe("campaign-scan");
    expect(transitionTui(campaignState, "repair", data).effect).toBe("campaign-repair");
    expect(transitionTui(campaignState, "archive", data).effect).toBe("campaign-archive-toggle");
    expect(transitionTui(campaignState, "remove", data).effect).toBe("campaign-remove");

    expect(transitionTui(initialTuiState(), "palette", data).effect).toBe("open-palette");
    expect(initialTuiState("tokyo-night", false, true).overlay).toEqual({ kind: "onboarding", step: "welcome" });
  });

  it("traps base navigation while an interactive overlay is open", () => {
    const data = model();
    const state = { ...initialTuiState(), overlay: { kind: "palette" as const, query: "", selected: 0 } };
    const result = transitionTui(state, "down", data);
    expect(result.state).toBe(state);
    expect(result.effect).toBe("none");
  });

  it("traps input inside reward modals and dismisses them safely", () => {
    const data = model();
    let state = initialTuiState("tokyo-night", true);
    const homeIndex = state.homeIndex;
    state = transitionTui(state, "down", data).state;
    expect(state.homeIndex).toBe(homeIndex);
    expect(state.modalOpen).toBe(true);

    const dismissal = transitionTui(state, "enter", data);
    expect(dismissal.effect).toBe("ack-rewards");
    state = dismissal.state;
    expect(state.modalOpen).toBe(false);
    state = transitionTui(state, "down", data).state;
    expect(state.homeIndex).toBe(homeIndex + 1);
  });
});
