#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const versionSource = fs.readFileSync(path.join(root, "src", "version.ts"), "utf8");
const flake = fs.readFileSync(path.join(root, "flake.nix"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const lockfile = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const themeSource = fs.readFileSync(path.join(root, "src", "tui", "theme.ts"), "utf8");
const tuiTypes = fs.readFileSync(path.join(root, "src", "tui", "types.ts"), "utf8");

const failures = [];
const version = String(packageJson.version);
if (!versionSource.includes(`APP_VERSION = "${version}"`)) failures.push("src/version.ts does not match package.json");
if (!flake.includes(`version = "${version}"`)) failures.push("flake.nix does not match package.json");
if (!changelog.includes(`## ${version}`)) failures.push("CHANGELOG.md is missing the release version");
if (/applied-caas|openai\.org\/artifactory/i.test(lockfile)) failures.push("package-lock.json contains an internal registry URL");
for (const required of ["README.md", "LICENSE", "SECURITY.md", "CHANGELOG.md", "docs/PRISM_RELEASE.md"]) {
  if (!fs.existsSync(path.join(root, required))) failures.push(`${required} is missing`);
}

const prismThemes = [
  "tokyo-night", "arcane", "catppuccin", "everforest", "matrix", "nord",
  "rose-pine", "gruvbox-dark", "dracula", "solarized-dark", "monochrome",
  "obsidian-ink", "synthwave", "amber-terminal", "iceberg", "cyberdeck"
];
for (const theme of prismThemes) {
  if (!themeSource.includes(`id: "${theme}"`)) failures.push(`Prism theme is missing: ${theme}`);
}
if (!tuiTypes.includes('"profile"')) failures.push("The Profile TUI screen is missing");

if (failures.length > 0) {
  console.error("Release verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

execFileSync("npm", ["run", "check"], { cwd: root, stdio: "inherit" });
execFileSync("npm", ["pack", "--dry-run"], { cwd: root, stdio: "inherit" });
console.log(`\nCommitQuest ${version} release verification passed.`);
