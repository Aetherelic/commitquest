import fs from "node:fs";
import path from "node:path";
import { achievementStates } from "./achievements.js";
import { calculateLevel } from "./levels.js";
import { getProfile } from "./profile.js";
import { calculateStreak } from "./streak.js";
import { playerClassStates } from "./classes.js";
import {
  databaseStats,
  listRepositories,
  totalXp,
  type CommitQuestDatabase
} from "../data/database.js";
import { getShareDirectory } from "../data/paths.js";

export type ShareFormat = "markdown" | "svg" | "json";

export interface PublicJourney {
  generatedAt: string;
  name: string;
  level: number;
  title: string;
  totalXp: number;
  streak: number;
  campaigns: number;
  commits: number;
  releases: number;
  achievements: number;
  developerClass: string;
  classTitle: string;
  projects?: string[];
}

export function buildPublicJourney(
  db: CommitQuestDatabase,
  options: { publicName?: string; includeProjects?: boolean; now?: Date } = {}
): PublicJourney {
  const now = options.now ?? new Date();
  const profile = getProfile(db);
  const stats = databaseStats(db);
  const xp = totalXp(db);
  const level = calculateLevel(xp);
  const dates = db.prepare("SELECT authored_at AS authoredAt FROM commits").all() as Array<{ authoredAt: string }>;
  const classState = playerClassStates(db).find((entry) => entry.selected)!;
  const result: PublicJourney = {
    generatedAt: now.toISOString(),
    name: options.publicName?.trim() || profile.name || "Developer",
    level: level.level,
    title: level.title,
    totalXp: xp,
    streak: calculateStreak(dates.map((row) => row.authoredAt), now).current,
    campaigns: stats.repositories,
    commits: stats.commits,
    releases: stats.tags,
    achievements: achievementStates(db).filter((achievement) => achievement.unlocked).length,
    developerClass: classState.title,
    classTitle: classState.unlockedSkills.at(-1)?.title ?? classState.title
  };
  if (options.includeProjects) {
    result.projects = listRepositories(db).map((repository) => repository.name);
  }
  return result;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character]!);
}

export function journeyMarkdown(journey: PublicJourney): string {
  const projectSection = journey.projects?.length
    ? `\n**Campaigns:** ${journey.projects.map((project) => `\`${project}\``).join(" · ")}\n`
    : "";
  return `# ${journey.name} · CommitQuest Journey\n\n` +
    `**Level ${journey.level} — ${journey.title}**  \n` +
    `${journey.classTitle} · ${journey.developerClass}\n\n` +
    `| XP | Streak | Commits | Campaigns | Releases | Badges |\n` +
    `|---:|---:|---:|---:|---:|---:|\n` +
    `| ${journey.totalXp} | ${journey.streak} days | ${journey.commits} | ${journey.campaigns} | ${journey.releases} | ${journey.achievements} |\n` +
    projectSection +
    `\n> Generated locally by CommitQuest. No commit subjects or repository paths are included.\n`;
}

export function journeySvg(journey: PublicJourney): string {
  const name = escapeXml(journey.name);
  const classTitle = escapeXml(journey.classTitle);
  const title = escapeXml(journey.title);
  const cards = [
    ["LEVEL", `${journey.level} · ${title}`],
    ["TOTAL XP", String(journey.totalXp)],
    ["STREAK", `${journey.streak} DAYS`],
    ["CAMPAIGNS", String(journey.campaigns)],
    ["COMMITS", String(journey.commits)],
    ["RELEASES", String(journey.releases)],
    ["BADGES", String(journey.achievements)],
    ["CLASS", classTitle]
  ];
  const cardMarkup = cards.map(([label, value], index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 54 + column * 212;
    const y = 246 + row * 112;
    return `<g transform="translate(${x} ${y})"><rect width="190" height="88" rx="14" fill="#24283b" stroke="#7aa2f7" stroke-opacity="0.45"/><text x="16" y="28" fill="#7dcfff" font-size="12" font-weight="700" letter-spacing="1.5">${label}</text><text x="16" y="59" fill="#c0caf5" font-size="20" font-weight="700">${value}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="520" viewBox="0 0 920 520" role="img" aria-label="${name} CommitQuest journey card">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1a1b26"/><stop offset="1" stop-color="#16161e"/></linearGradient><linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7aa2f7"/><stop offset="1" stop-color="#bb9af7"/></linearGradient></defs>
  <rect width="920" height="520" rx="28" fill="url(#bg)"/>
  <rect x="18" y="18" width="884" height="484" rx="22" fill="none" stroke="url(#accent)" stroke-width="2" opacity="0.65"/>
  <text x="54" y="82" fill="#7dcfff" font-family="ui-monospace, monospace" font-size="18" font-weight="700" letter-spacing="4">COMMITQUEST</text>
  <text x="54" y="143" fill="#c0caf5" font-family="ui-monospace, monospace" font-size="38" font-weight="800">${name}</text>
  <text x="54" y="180" fill="#bb9af7" font-family="ui-monospace, monospace" font-size="19">${classTitle} · Level ${journey.level}</text>
  <text x="54" y="211" fill="#565f89" font-family="ui-monospace, monospace" font-size="15">Level up by shipping real work.</text>
  ${cardMarkup}
  <text x="866" y="480" text-anchor="end" fill="#565f89" font-family="ui-monospace, monospace" font-size="13">Made with &lt;3 by Aetherelic</text>
</svg>\n`;
}

export function writeJourneyShare(
  db: CommitQuestDatabase,
  format: ShareFormat,
  options: { output?: string; publicName?: string; includeProjects?: boolean; now?: Date } = {}
): string {
  const journey = buildPublicJourney(db, options);
  const extension = format === "markdown" ? "md" : format;
  const destination = options.output
    ? path.resolve(options.output)
    : path.join(getShareDirectory(), `commitquest-journey.${extension}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const content = format === "svg"
    ? journeySvg(journey)
    : format === "markdown"
      ? journeyMarkdown(journey)
      : `${JSON.stringify(journey, null, 2)}\n`;
  fs.writeFileSync(destination, content, { mode: 0o600 });
  return destination;
}
