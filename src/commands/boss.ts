import chalk from "chalk";
import { completeBossEncounter, inspectBossEncounter } from "../core/boss.js";
import { openDatabase } from "../data/database.js";

function renderEncounter(encounter: ReturnType<typeof inspectBossEncounter>): void {
  console.log(chalk.bold(`BOSS ENCOUNTER · ${encounter.repository.name} v${encounter.battle.version}\n`));
  for (const check of encounter.checks) {
    const marker = check.state === "pass" ? chalk.green("◆") : check.state === "fail" ? chalk.red("✗") : chalk.yellow("◇");
    console.log(`${marker} ${check.title}`);
    console.log(`  ${check.detail}`);
  }
  console.log(`\nStatus: ${encounter.ready ? chalk.green("READY") : chalk.yellow("PREPARING")}`);
}

export function bossBeginCommand(repo: string, version: string, options: { testCommand?: string }): void {
  const db = openDatabase();
  try {
    renderEncounter(inspectBossEncounter(db, repo, version, { testCommand: options.testCommand ?? null }));
  } finally {
    db.close();
  }
}

export function bossStatusCommand(repo: string, version: string, options: { runTests?: boolean; testCommand?: string }): void {
  const db = openDatabase();
  try {
    renderEncounter(inspectBossEncounter(db, repo, version, {
      runTests: options.runTests ?? false,
      testCommand: options.testCommand ?? null
    }));
  } finally {
    db.close();
  }
}

export function bossCompleteCommand(
  repo: string,
  version: string,
  options: { createTag?: boolean; noTests?: boolean; testCommand?: string }
): void {
  const db = openDatabase();
  try {
    const encounter = completeBossEncounter(db, repo, version, {
      createTag: options.createTag ?? false,
      runTests: !(options.noTests ?? false),
      testCommand: options.testCommand ?? null
    });
    console.log(`${chalk.green("◆ BOSS DEFEATED")} ${encounter.repository.name} v${encounter.battle.version}`);
    console.log("  +300 XP · release tag recorded locally");
    console.log("  CommitQuest never pushes tags automatically.");
  } finally {
    db.close();
  }
}
