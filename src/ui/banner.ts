import chalk from "chalk";

export function renderBanner(): string {
  const markPlain = "COMMITQUEST";
  const taglinePlain = "Level up by shipping real work.";
  const mark = chalk.bold.magenta("COMMIT") + chalk.bold.cyan("QUEST");
  const markPadding = " ".repeat(40 - markPlain.length);
  const taglinePadding = " ".repeat(40 - taglinePlain.length);

  return [
    "",
    `  ${chalk.dim("╭──────────────────────────────────────────╮")}`,
    `  ${chalk.dim("│")}  ${mark}${markPadding}${chalk.dim("│")}`,
    `  ${chalk.dim("│")}  ${chalk.dim(taglinePlain)}${taglinePadding}${chalk.dim("│")}`,
    `  ${chalk.dim("╰──────────────────────────────────────────╯")}`,
    ""
  ].join("\n");
}
