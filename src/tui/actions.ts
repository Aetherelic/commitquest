import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  abandonCustomQuest,
  addRepository,
  createCustomQuest,
  getCustomQuest,
  openDatabase,
  removeRepository,
  setMeta,
  setRepositoryArchived,
  updateCustomQuest,
  updateRepository
} from "../data/database.js";
import { completeManualCustomQuest, CUSTOM_QUEST_COMMIT_OBJECTIVES } from "../core/custom-quests.js";
import { updateProfile } from "../core/profile.js";
import { scanRepositories } from "../core/scan.js";
import type { CustomQuestObjective, CustomQuestState } from "../core/types.js";
import {
  getDefaultBranch,
  getRepositoryName,
  getRepositoryRoot,
  isGitRepository,
  resolveRepositoryPath
} from "../git/git.js";
import { installPostCommitHook } from "../git/hooks.js";
import { TUI_THEMES } from "./theme.js";
import { ensureDefaultChapters } from "../core/chapters.js";
import { choosePlayerClass } from "../core/classes.js";
import { writeJourneyShare } from "../core/share.js";
import type {
  TuiActionId,
  TuiCampaign,
  TuiConfirmOverlay,
  TuiFormField,
  TuiFormOverlay,
  TuiModel,
  TuiPaletteEntry,
  TuiState
} from "./types.js";

export const TUI_QUEST_OBJECTIVES: CustomQuestObjective[] = [
  "commit",
  ...CUSTOM_QUEST_COMMIT_OBJECTIVES,
  "release",
  "manual"
];

function installedCliPath(): string {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(directory, "../cli.js");
}

function selectedQuest(model: TuiModel, state: TuiState): CustomQuestState | null {
  const customIndex = state.selected.quests - model.quests.length;
  return customIndex >= 0 ? model.customQuests[customIndex] ?? null : null;
}

function selectedCampaign(model: TuiModel, state: TuiState): TuiCampaign | null {
  return model.campaigns[state.selected.campaigns] ?? null;
}

function choices<T extends string>(values: readonly T[]): Array<{ label: string; value: string }> {
  return values.map((value) => ({ label: value, value }));
}

function repositoryChoices(model: TuiModel): Array<{ label: string; value: string }> {
  return [
    { label: "All campaigns", value: "" },
    ...model.campaigns.filter((campaign) => !campaign.archived).map((campaign) => ({
      label: campaign.name,
      value: String(campaign.id)
    }))
  ];
}

function questForm(model: TuiModel, quest: CustomQuestState | null = null): TuiFormOverlay {
  return {
    kind: "form",
    title: quest ? `Edit Quest #${quest.id}` : "Create New Quest",
    action: quest ? "quest-edit" : "quest-create",
    fields: [
      {
        key: "title",
        label: "Title",
        kind: "text",
        value: quest?.title ?? "",
        placeholder: "Describe the objective",
        required: true
      },
      {
        key: "repositoryId",
        label: "Campaign",
        kind: "choice",
        value: quest?.repositoryId === null || quest === null ? "" : String(quest.repositoryId),
        choices: repositoryChoices(model)
      },
      {
        key: "objectiveType",
        label: "Objective",
        kind: "choice",
        value: quest?.objectiveType ?? "manual",
        choices: choices(TUI_QUEST_OBJECTIVES)
      },
      {
        key: "target",
        label: "Target",
        kind: "number",
        value: String(quest?.target ?? 1),
        required: true
      },
      {
        key: "rewardXp",
        label: "Reward XP",
        kind: "number",
        value: String(quest?.rewardXp ?? 100),
        required: true
      },
      {
        key: "deadline",
        label: "Deadline",
        kind: "text",
        value: quest?.deadlineAt ? quest.deadlineAt.slice(0, 10) : "",
        placeholder: "Optional YYYY-MM-DD"
      },
      ...(quest ? [{ key: "questId", label: "Quest ID", kind: "text" as const, value: String(quest.id), secret: true }] : [])
    ],
    fieldIndex: 0,
    error: null,
    submitLabel: quest ? "Save Changes" : "Create Quest",
    cancelLabel: "Cancel"
  };
}

function campaignForm(kind: "add" | "repair", campaign: TuiCampaign | null = null): TuiFormOverlay {
  return {
    kind: "form",
    title: kind === "add" ? "Add Campaign" : `Repair ${campaign?.name ?? "Campaign"}`,
    action: kind === "add" ? "campaign-add" : "campaign-repair",
    fields: [
      {
        key: "path",
        label: "Repository Path",
        kind: "text",
        value: campaign?.path ?? "",
        placeholder: "~/Projects/project",
        required: true
      },
      ...(kind === "add" ? [
        {
          key: "name",
          label: "Campaign Name",
          kind: "text" as const,
          value: "",
          placeholder: "Optional; defaults to repository name"
        },
        {
          key: "liveRewards",
          label: "Live Rewards",
          kind: "boolean" as const,
          value: "true"
        }
      ] : [
        { key: "campaignId", label: "Campaign ID", kind: "text" as const, value: String(campaign?.id ?? ""), secret: true }
      ])
    ],
    fieldIndex: 0,
    error: null,
    submitLabel: kind === "add" ? "Add Campaign" : "Repair Path",
    cancelLabel: "Cancel"
  };
}

function confirmation(
  title: string,
  message: string[],
  action: TuiActionId,
  confirmLabel: string,
  options: { dangerous?: boolean; verification?: string } = {}
): TuiConfirmOverlay {
  return {
    kind: "confirm",
    title,
    message,
    action,
    confirmLabel,
    ...(options.dangerous === undefined ? {} : { dangerous: options.dangerous }),
    ...(options.verification === undefined ? {} : { verification: options.verification }),
    typed: "",
    error: null
  };
}

export function availablePaletteEntries(model: TuiModel, state: TuiState): TuiPaletteEntry[] {
  const quest = selectedQuest(model, state);
  const campaign = selectedCampaign(model, state);
  return [
    { id: "open-home", label: "Open Home", description: "Return to the launcher", shortcut: "Esc", enabled: true },
    { id: "open-profile", label: "Open Profile", description: "View the full-screen journey card", enabled: true },
    { id: "open-quests", label: "Open Quest Board", description: "Browse active and completed quests", enabled: true },
    { id: "quest-create", label: "Create Quest", description: "Build a guided custom objective", shortcut: "N", enabled: true },
    { id: "quest-edit", label: "Edit Selected Quest", description: "Change an active custom quest", shortcut: "E", enabled: Boolean(quest && quest.status === "active") },
    { id: "quest-complete", label: "Complete Manual Quest", description: "Claim an active manual objective", shortcut: "C", enabled: Boolean(quest && quest.status === "active" && quest.objectiveType === "manual") },
    { id: "quest-abandon", label: "Abandon Selected Quest", description: "Stop tracking an active custom quest", shortcut: "A", enabled: Boolean(quest && quest.status === "active") },
    { id: "open-campaigns", label: "Open Campaigns", description: "Browse tracked repositories", enabled: true },
    { id: "open-chapters", label: "Open Chapters", description: "Review campaign arcs and boss encounters", enabled: true },
    { id: "campaign-add", label: "Add Campaign", description: "Track another local Git repository", shortcut: "N", enabled: true },
    { id: "campaign-scan", label: "Scan Selected Campaign", description: "Import new Git activity", shortcut: "S", enabled: Boolean(campaign && !campaign.archived) },
    { id: "campaign-repair", label: "Repair Campaign Path", description: "Reconnect a moved repository", shortcut: "P", enabled: Boolean(campaign) },
    { id: campaign?.archived ? "campaign-restore" : "campaign-archive", label: campaign?.archived ? "Restore Campaign" : "Archive Campaign", description: campaign?.archived ? "Resume automatic scans" : "Pause scans while keeping progress", shortcut: "X", enabled: Boolean(campaign) },
    { id: "campaign-remove", label: "Remove Campaign", description: "Delete CommitQuest tracking data only", shortcut: "D", enabled: Boolean(campaign) },
    { id: "refresh-all", label: "Refresh All Campaigns", description: "Scan every active campaign", shortcut: "R", enabled: true },
    { id: "open-achievements", label: "Open Badges", description: "Browse achievement progress", enabled: true },
    { id: "open-progress", label: "Open Progress", description: "View XP, streaks, and charts", enabled: true },
    { id: "open-path", label: "Open Developer Path", description: "Choose a class and view cosmetic skills", enabled: true },
    { id: "class-choose", label: "Choose Highlighted Path", description: "Set the selected cosmetic class", shortcut: "Enter", enabled: state.screen === "path" && model.classes.length > 0 },
    { id: "open-log", label: "Open Adventure Log", description: "Review recent rewards", enabled: true },
    { id: "open-share", label: "Open Share Journey", description: "Preview privacy-safe exports", enabled: true },
    { id: "share-export", label: "Export Highlighted Journey Card", description: "Write the selected format locally", shortcut: "Enter", enabled: state.screen === "share" },
    { id: "open-themes", label: "Open Themes", description: "Preview and save a palette", shortcut: "T", enabled: true },
    { id: "show-detail", label: "Open Full Detail", description: "Expand the selected item", shortcut: "Enter", enabled: state.screen !== "home" && state.screen !== "profile" && state.screen !== "themes" && state.screen !== "progress" }
  ];
}

export function filteredPaletteEntries(model: TuiModel, state: TuiState): TuiPaletteEntry[] {
  const query = state.overlay?.kind === "palette" ? state.overlay.query.trim().toLowerCase() : "";
  const entries = availablePaletteEntries(model, state);
  if (!query) return entries;
  return entries.filter((entry) => `${entry.label} ${entry.description}`.toLowerCase().includes(query));
}

export function openTuiAction(state: TuiState, action: TuiActionId, model: TuiModel): TuiState {
  const quest = selectedQuest(model, state);
  const campaign = selectedCampaign(model, state);
  switch (action) {
    case "open-home": return { ...state, screen: "home", overlay: null };
    case "open-profile": return { ...state, screen: "profile", overlay: null };
    case "open-quests": return { ...state, screen: "quests", overlay: null };
    case "open-campaigns": return { ...state, screen: "campaigns", overlay: null };
    case "open-chapters": return { ...state, screen: "chapters", overlay: null };
    case "open-achievements": return { ...state, screen: "achievements", overlay: null };
    case "open-progress": return { ...state, screen: "progress", overlay: null };
    case "open-path": return { ...state, screen: "path", overlay: null };
    case "open-log": return { ...state, screen: "log", overlay: null };
    case "open-share": return { ...state, screen: "share", overlay: null };
    case "open-themes": return { ...state, screen: "themes", overlay: null };
    case "show-detail":
      if (state.screen === "home" || state.screen === "profile" || state.screen === "themes" || state.screen === "path" || state.screen === "share") return state;
      return { ...state, overlay: { kind: "detail", screen: state.screen } };
    case "quest-create": return { ...state, overlay: questForm(model) };
    case "quest-edit": return quest && quest.status === "active" ? { ...state, overlay: questForm(model, quest) } : state;
    case "quest-complete":
      return quest && quest.status === "active" && quest.objectiveType === "manual"
        ? { ...state, overlay: confirmation("Complete Manual Quest", [`#${quest.id} ${quest.title}`, `Reward: +${quest.rewardXp} XP`], action, "Complete Quest") }
        : state;
    case "quest-abandon":
      return quest && quest.status === "active"
        ? { ...state, overlay: confirmation("Abandon Quest", [`#${quest.id} ${quest.title}`, "Progress is preserved in history, but this quest cannot be resumed."], action, "Abandon Quest", { dangerous: true }) }
        : state;
    case "campaign-add": return { ...state, overlay: campaignForm("add") };
    case "campaign-repair": return campaign ? { ...state, overlay: campaignForm("repair", campaign) } : state;
    case "campaign-archive":
      return campaign ? { ...state, overlay: confirmation("Archive Campaign", [campaign.name, "Automatic scans will pause. All progress remains available."], action, "Archive") } : state;
    case "campaign-restore":
      return campaign ? { ...state, overlay: confirmation("Restore Campaign", [campaign.name, "Automatic scans will resume on the next refresh."], action, "Restore") } : state;
    case "campaign-remove":
      return campaign ? { ...state, overlay: confirmation(
        "Remove Campaign",
        [campaign.name, "CommitQuest activity, tags, and linked campaign data will be removed.", "The Git repository itself will never be deleted."],
        action,
        "Remove Tracking Data",
        { dangerous: true, verification: campaign.name }
      ) } : state;
    case "campaign-scan":
    case "class-choose":
    case "share-export":
    case "refresh-all":
    case "onboarding-begin":
    case "onboarding-skip-campaign":
      return state;
  }
}

function fieldValue(fields: TuiFormField[], key: string): string {
  return fields.find((field) => field.key === key)?.value.trim() ?? "";
}

function positiveInteger(value: string, label: string, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be a whole number between 1 and ${maximum}.`);
  }
  return parsed;
}

function parseDeadline(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Deadline must use YYYY-MM-DD format.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    throw new Error("Deadline is not a valid calendar date.");
  }
  return date.toISOString();
}

function parseQuestFields(fields: TuiFormField[]): {
  title: string;
  repositoryId: number | null;
  objectiveType: CustomQuestObjective;
  target: number;
  rewardXp: number;
  deadlineAt: string | null;
} {
  const title = fieldValue(fields, "title");
  if (!title) throw new Error("Quest title cannot be empty.");
  if (title.length > 120) throw new Error("Quest title cannot exceed 120 characters.");
  const objectiveType = fieldValue(fields, "objectiveType") as CustomQuestObjective;
  if (!TUI_QUEST_OBJECTIVES.includes(objectiveType)) throw new Error("Choose a valid quest objective.");
  const target = objectiveType === "manual" ? 1 : positiveInteger(fieldValue(fields, "target"), "Target", 1000);
  return {
    title,
    repositoryId: fieldValue(fields, "repositoryId") ? positiveInteger(fieldValue(fields, "repositoryId"), "Campaign", Number.MAX_SAFE_INTEGER) : null,
    objectiveType,
    target,
    rewardXp: positiveInteger(fieldValue(fields, "rewardXp"), "Reward XP", 10000),
    deadlineAt: parseDeadline(fieldValue(fields, "deadline"))
  };
}

export interface TuiExecutionResult {
  notice: string;
  scan?: boolean;
  onboardingNext?: "campaign" | "theme" | "complete";
  themeId?: string;
}

export function executeFormOverlay(form: TuiFormOverlay, model: TuiModel): TuiExecutionResult {
  const db = openDatabase();
  try {
    if (form.action === "quest-create") {
      const values = parseQuestFields(form.fields);
      const quest = createCustomQuest(db, values);
      return { notice: `Quest created · #${quest.id} ${quest.title}` };
    }
    if (form.action === "quest-edit") {
      const values = parseQuestFields(form.fields);
      const id = positiveInteger(fieldValue(form.fields, "questId"), "Quest ID", Number.MAX_SAFE_INTEGER);
      const quest = updateCustomQuest(db, id, values);
      return { notice: `Quest updated · #${quest.id} ${quest.title}` };
    }
    if (form.action === "campaign-add" || form.action === "onboarding-campaign") {
      const input = fieldValue(form.fields, "path");
      if (!input) {
        if (form.action === "onboarding-campaign") return { notice: "Campaign setup skipped.", onboardingNext: "theme" };
        throw new Error("Repository path cannot be empty.");
      }
      let resolved: string;
      try {
        resolved = resolveRepositoryPath(input.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
      } catch {
        throw new Error(`Path does not exist: ${input}`);
      }
      if (!isGitRepository(resolved)) throw new Error(`${resolved} is not a Git repository.`);
      const root = getRepositoryRoot(resolved);
      const repository = addRepository(db, {
        name: fieldValue(form.fields, "name") || getRepositoryName(root),
        path: root,
        defaultBranch: getDefaultBranch(root)
      });
      ensureDefaultChapters(db, repository);
      if (fieldValue(form.fields, "liveRewards") !== "false") {
        installPostCommitHook(root, { nodePath: process.execPath, cliPath: installedCliPath() });
      }
      if (model.profile.email) scanRepositories(db, [repository], model.profile.email);
      return form.action === "onboarding-campaign"
        ? { notice: `Campaign added · ${repository.name}`, onboardingNext: "theme" }
        : { notice: `Campaign added · ${repository.name}` };
    }
    if (form.action === "campaign-repair") {
      const id = positiveInteger(fieldValue(form.fields, "campaignId"), "Campaign ID", Number.MAX_SAFE_INTEGER);
      const input = fieldValue(form.fields, "path");
      let resolved: string;
      try {
        resolved = resolveRepositoryPath(input.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
      } catch {
        throw new Error(`Path does not exist: ${input}`);
      }
      if (!isGitRepository(resolved)) throw new Error(`${resolved} is not a Git repository.`);
      const root = getRepositoryRoot(resolved);
      const repository = updateRepository(db, id, { path: root, defaultBranch: getDefaultBranch(root) });
      return { notice: `Campaign repaired · ${repository.name}` };
    }
    if (form.action === "onboarding-profile") {
      const name = fieldValue(form.fields, "name");
      const email = fieldValue(form.fields, "email").toLowerCase();
      if (!name) throw new Error("Choose a display name.");
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid Git author email.");
      updateProfile(db, { name, email });
      return { notice: `Welcome, ${name}.`, onboardingNext: "campaign" };
    }
    if (form.action === "onboarding-theme") {
      const themeId = fieldValue(form.fields, "theme");
      if (!TUI_THEMES.some((theme) => theme.id === themeId)) throw new Error("Choose a valid theme.");
      setMeta(db, "tui.onboarding-complete-v1", "true");
      return { notice: "Your journey is ready.", onboardingNext: "complete", themeId };
    }
    throw new Error("This form action is not implemented.");
  } finally {
    db.close();
  }
}

export function executeConfirmedAction(
  action: TuiActionId,
  model: TuiModel,
  state: TuiState
): TuiExecutionResult {
  const quest = selectedQuest(model, state);
  const campaign = selectedCampaign(model, state);
  const db = openDatabase();
  try {
    switch (action) {
      case "quest-complete":
        if (!quest) throw new Error("Select a custom quest first.");
        completeManualCustomQuest(db, quest.id);
        return { notice: `Quest complete · #${quest.id} ${quest.title}` };
      case "quest-abandon":
        if (!quest) throw new Error("Select a custom quest first.");
        if (!abandonCustomQuest(db, quest.id, new Date().toISOString())) throw new Error("Quest could not be abandoned.");
        return { notice: `Quest abandoned · #${quest.id} ${quest.title}` };
      case "campaign-archive":
        if (!campaign || !setRepositoryArchived(db, campaign.id, true)) throw new Error("Campaign could not be archived.");
        return { notice: `Campaign archived · ${campaign.name}` };
      case "campaign-restore":
        if (!campaign || !setRepositoryArchived(db, campaign.id, false)) throw new Error("Campaign could not be restored.");
        return { notice: `Campaign restored · ${campaign.name}` };
      case "campaign-remove":
        if (!campaign || !removeRepository(db, campaign.id)) throw new Error("Campaign could not be removed.");
        return { notice: `Campaign removed from CommitQuest · ${campaign.name}` };
      default:
        throw new Error("This confirmation action is not implemented.");
    }
  } finally {
    db.close();
  }
}

export function executeImmediateAction(action: TuiActionId, model: TuiModel, state: TuiState): TuiExecutionResult {
  if (action === "refresh-all") return { notice: "Journey refreshed.", scan: true };
  if (action === "campaign-scan") {
    const campaign = selectedCampaign(model, state);
    if (!campaign) throw new Error("Select a campaign first.");
    if (campaign.archived) throw new Error("Restore this campaign before scanning it.");
    const db = openDatabase();
    try {
      const summary = scanRepositories(db, [campaign], model.profile.email);
      return { notice: `${campaign.name} scanned · ${summary.importedCommits} commits · ${summary.importedTags} releases · +${summary.earnedXp} XP` };
    } finally {
      db.close();
    }
  }
  if (action === "class-choose") {
    const selected = model.classes[state.selected.path];
    if (!selected) throw new Error("Select a developer path first.");
    const db = openDatabase();
    try {
      choosePlayerClass(db, selected.id);
      return { notice: `Developer path selected · ${selected.title}` };
    } finally {
      db.close();
    }
  }
  if (action === "share-export") {
    const formats = ["svg", "markdown", "json"] as const;
    const format = formats[state.selected.share] ?? "svg";
    const db = openDatabase();
    try {
      const destination = writeJourneyShare(db, format);
      return { notice: `Journey exported · ${destination}` };
    } finally {
      db.close();
    }
  }
  throw new Error("This immediate action is not implemented.");
}

export function onboardingProfileForm(model: TuiModel): TuiFormOverlay {
  return {
    kind: "form",
    title: "Create Your Adventurer",
    action: "onboarding-profile",
    fields: [
      { key: "name", label: "Display Name", kind: "text", value: model.profile.name === "Adventurer" ? "" : model.profile.name, placeholder: "Aetherelic", required: true },
      { key: "email", label: "Git Email", kind: "text", value: model.profile.email, placeholder: "you@example.com", required: true }
    ],
    fieldIndex: 0,
    error: null,
    submitLabel: "Continue",
    cancelLabel: "Exit"
  };
}

export function onboardingCampaignForm(): TuiFormOverlay {
  const form = campaignForm("add");
  return {
    ...form,
    title: "Choose Your First Campaign",
    action: "onboarding-campaign",
    allowSkip: true,
    submitLabel: "Add and Continue",
    cancelLabel: "Skip for Now"
  };
}

export function onboardingThemeForm(activeThemeId: string): TuiFormOverlay {
  return {
    kind: "form",
    title: "Choose Your Theme",
    action: "onboarding-theme",
    fields: [{
      key: "theme",
      label: "Theme",
      kind: "choice",
      value: activeThemeId,
      choices: TUI_THEMES.map((theme) => ({ label: theme.name, value: theme.id }))
    }],
    fieldIndex: 0,
    error: null,
    submitLabel: "Begin Journey",
    cancelLabel: "Back"
  };
}

export function markOnboardingComplete(): void {
  const db = openDatabase();
  try {
    setMeta(db, "tui.onboarding-complete-v1", "true");
  } finally {
    db.close();
  }
}
