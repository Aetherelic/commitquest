import { getMeta, setMeta, type CommitQuestDatabase } from "../data/database.js";
import type {
  CommitType,
  PlayerClassDefinition,
  PlayerClassId,
  PlayerClassState
} from "./types.js";

const SKILL_LEVELS = [0, 200, 500, 1000, 1800] as const;

export const PLAYER_CLASSES: PlayerClassDefinition[] = [
  {
    id: "architect",
    title: "Architect",
    description: "Shapes systems, infrastructure, performance, and durable foundations.",
    affinityTypes: ["build", "ci", "refactor", "perf"],
    skillTitles: [
      { level: 1, title: "Blueprint Reader", description: "Begin the Architect path." },
      { level: 2, title: "Foundation Smith", description: "Earn 200 class XP." },
      { level: 3, title: "Systems Cartographer", description: "Earn 500 class XP." },
      { level: 4, title: "Keeper of Architecture", description: "Earn 1,000 class XP." },
      { level: 5, title: "Grand Architect", description: "Earn 1,800 class XP." }
    ]
  },
  {
    id: "artificer",
    title: "Artificer",
    description: "Crafts features, interfaces, and expressive user experiences.",
    affinityTypes: ["feat", "style"],
    skillTitles: [
      { level: 1, title: "Workshop Initiate", description: "Begin the Artificer path." },
      { level: 2, title: "Interface Crafter", description: "Earn 200 class XP." },
      { level: 3, title: "Experience Weaver", description: "Earn 500 class XP." },
      { level: 4, title: "Master of Form", description: "Earn 1,000 class XP." },
      { level: 5, title: "Mythic Artificer", description: "Earn 1,800 class XP." }
    ]
  },
  {
    id: "sentinel",
    title: "Sentinel",
    description: "Defends reliability through tests, fixes, security, and careful verification.",
    affinityTypes: ["fix", "test", "revert"],
    skillTitles: [
      { level: 1, title: "Watch Recruit", description: "Begin the Sentinel path." },
      { level: 2, title: "Bug Warden", description: "Earn 200 class XP." },
      { level: 3, title: "Guardian of Builds", description: "Earn 500 class XP." },
      { level: 4, title: "Reliability Marshal", description: "Earn 1,000 class XP." },
      { level: 5, title: "Eternal Sentinel", description: "Earn 1,800 class XP." }
    ]
  },
  {
    id: "maintainer",
    title: "Maintainer",
    description: "Keeps projects understandable, healthy, documented, and ready for others.",
    affinityTypes: ["docs", "chore"],
    skillTitles: [
      { level: 1, title: "Archive Keeper", description: "Begin the Maintainer path." },
      { level: 2, title: "Project Steward", description: "Earn 200 class XP." },
      { level: 3, title: "Community Scribe", description: "Earn 500 class XP." },
      { level: 4, title: "Legacy Curator", description: "Earn 1,000 class XP." },
      { level: 5, title: "Grand Maintainer", description: "Earn 1,800 class XP." }
    ]
  },
  {
    id: "explorer",
    title: "Explorer",
    description: "Experiments broadly and earns progress across every style of development.",
    affinityTypes: ["feat", "fix", "docs", "test", "refactor", "perf", "build", "ci", "chore", "style", "revert", "commit"],
    skillTitles: [
      { level: 1, title: "Trailfinder", description: "Begin the Explorer path." },
      { level: 2, title: "Polyglot Wanderer", description: "Earn 200 class XP." },
      { level: 3, title: "Frontier Scholar", description: "Earn 500 class XP." },
      { level: 4, title: "Realm Walker", description: "Earn 1,000 class XP." },
      { level: 5, title: "Legendary Explorer", description: "Earn 1,800 class XP." }
    ]
  }
];

export function selectedClassId(db: CommitQuestDatabase): PlayerClassId {
  const stored = getMeta(db, "player.class");
  return PLAYER_CLASSES.some((definition) => definition.id === stored)
    ? stored as PlayerClassId
    : "explorer";
}

export function choosePlayerClass(db: CommitQuestDatabase, id: PlayerClassId): void {
  if (!PLAYER_CLASSES.some((definition) => definition.id === id)) {
    throw new Error(`Unknown developer class: ${id}`);
  }
  setMeta(db, "player.class", id);
}

function classXp(db: CommitQuestDatabase, definition: PlayerClassDefinition): number {
  const placeholders = definition.affinityTypes.map(() => "?").join(", ");
  const row = db.prepare(`
    SELECT COALESCE(SUM(awarded_xp), 0) AS xp, COUNT(DISTINCT type) AS diversity
    FROM commits
    WHERE type IN (${placeholders})
  `).get(...definition.affinityTypes) as { xp: number; diversity: number };
  const diversityBonus = definition.id === "explorer" ? Number(row.diversity) * 20 : 0;
  return Number(row.xp) + diversityBonus;
}

function classLevel(xp: number): number {
  let level = 1;
  for (let index = 1; index < SKILL_LEVELS.length; index += 1) {
    if (xp >= SKILL_LEVELS[index]!) level = index + 1;
  }
  return level;
}

export function playerClassStates(db: CommitQuestDatabase): PlayerClassState[] {
  const selected = selectedClassId(db);
  return PLAYER_CLASSES.map((definition) => {
    const xp = classXp(db, definition);
    const level = classLevel(xp);
    return {
      ...definition,
      selected: definition.id === selected,
      classXp: xp,
      classLevel: level,
      nextSkillAt: SKILL_LEVELS[level] ?? null,
      unlockedSkills: definition.skillTitles.filter((skill) => skill.level <= level)
    };
  });
}

export function selectedClassTitle(db: CommitQuestDatabase): string {
  const state = playerClassStates(db).find((entry) => entry.selected)!;
  return state.unlockedSkills.at(-1)?.title ?? state.title;
}

export function classForCommitType(type: CommitType): PlayerClassId[] {
  return PLAYER_CLASSES.filter((definition) => definition.affinityTypes.includes(type)).map((definition) => definition.id);
}
