<div align="center">

# ⚔️ CommitQuest

### Level up by shipping real work.

A local-first developer RPG that turns real Git activity into campaigns, XP, quests, chapters, release encounters, classes, streaks, and achievements.

[![CI](https://img.shields.io/github/actions/workflow/status/Aetherelic/commitquest/ci.yml?branch=main&style=for-the-badge&label=CI)](../../actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22.5%2B-111827?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-111827?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-local--first-111827?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-111827?style=for-the-badge)](LICENSE)

</div>

---

## The game

Run one command:

```bash
cq
```

CommitQuest opens a full-screen terminal game with a clean launcher and persistent themes.

```text
                         COMMITQUEST v0.5.0
                     LEVEL UP BY SHIPPING REAL WORK

                 Aetherelic · Level 8 Repository Ranger
                 ━━━━━━━━━━━━━━━━━━━────  720/900 XP

                 > /quests       active objectives
                   /campaigns    tracked repositories
                   /chapters     campaign arcs and bosses
                   /badges       achievement collection
                   /progress     levels, streaks, and charts
                   /path         developer class and skills
                   /log          recent Git rewards
                   /share        privacy-safe journey cards
                   /themes       persistent colour themes

                                      Made with <3 by Aetherelic
```

The CLI commands remain available for scripting and recovery, but the intended experience is the interactive application.

## Core features

### Real Git progression

- Scans local Git repositories without uploading their contents
- Awards XP for commits and annotated or lightweight tags
- Understands conventional commits such as `feat:`, `fix:`, `docs:`, and `test:`
- Filters commits using the configured Git author email
- Prevents duplicate XP and duplicate quest rewards
- Uses daily caps and diminishing rewards to discourage commit farming
- Supports automatic post-commit rewards without replacing an existing hook

### Quests and campaigns

- Built-in daily, weekly, and monthly quests
- Guided custom quest creation from inside the TUI
- Campaign-specific objectives and optional deadlines
- Automatic objectives for commits, commit types, and releases
- Manual milestones with explicit completion
- Campaign archive, restore, path repair, scan, and safe removal
- Typed confirmation before destructive tracking-data removal

### Chapters and boss encounters

Every campaign receives a persistent story arc:

```text
◆ Chapter I     The First Quest
> Chapter II    Gathering Momentum
· Chapter III   The Questmaster's Ledger
· Chapter IV    Face the First Boss
· Chapter V     A Lasting Campaign
```

Prepare a release encounter:

```bash
cq boss begin commitquest 0.5.0
cq boss status commitquest 0.5.0 --run-tests
cq boss complete commitquest 0.5.0 --create-tag
```

Boss encounters verify the working tree, project version, documentation, changelog, test command, and release tag. CommitQuest can create an annotated **local** tag only after the user explicitly passes `--create-tag`; it never pushes automatically.

### Developer paths

Choose a cosmetic class without XP multipliers or locked features:

- **Architect** — infrastructure, build systems, CI, refactors, and performance
- **Artificer** — features, interfaces, and visual craft
- **Sentinel** — fixes, tests, reliability, and reversions
- **Maintainer** — documentation, chores, and project stewardship
- **Explorer** — broad experimentation across commit types

```bash
cq class list
cq class choose artificer
```

Each path has five cosmetic titles driven by activity that already occurred naturally.

### Privacy-safe sharing

Generate a local SVG, Markdown profile, or JSON summary:

```bash
cq share --format svg
cq share --format markdown --output ./journey.md
cq share --format json
```

Default exports exclude:

- repository names
- repository paths
- Git email addresses
- commit subjects

Campaign names are included only with the explicit `--include-projects` flag.

### Stability and recovery

- SQLite integrity checks and WAL checkpointing
- Automatic backup before every database schema migration
- Manual backup and restore commands
- Safety backup before restore
- Atomic theme preferences
- TUI crash reports with terminal restoration
- `cq doctor --repair` for safe local repairs
- Detailed executable, runtime, schema, and theme diagnostics
- Deterministic local installer with an absolute Node runtime path
- Nix package that wraps Node and Git

```bash
cq version --verbose
cq doctor
cq doctor --repair
cq backup
cq backup list
cq backup restore latest --yes
```

## Installation

### NixOS or Nix

From the repository:

```bash
nix profile install .#commitquest
```

Or launch without installing:

```bash
nix run .
```

The Nix package wraps its own Node runtime and adds Git to the runtime path.

### Local npm installation

```bash
npm ci
./scripts/install-local.sh
```

The installer builds, runs the complete test suite, copies the package into `~/.local/lib/node_modules`, creates deterministic wrappers in `~/.local/bin`, and verifies the installed version.

Ensure the local bin directory is available:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## First journey

```bash
cq init
cq add ~/Projects/your-project
cq hook install ~/Projects/your-project
cq
```

Opening `cq` also provides interactive onboarding for the profile, first campaign, live rewards, and theme.

## Interactive controls

```text
↑ / ↓ or J / K      Move through items
← / → or H / L      Change screen
Enter               Open, choose, submit, or export
Esc                 Back or cancel
Tab / Shift+Tab     Cycle screens or form fields
/                   Searchable command palette
R                   Refresh active campaigns
T                   Theme gallery
?                   Help
Q or Ctrl+C         Quit safely
```

Quest and campaign screens display their contextual actions in the footer.

## Advanced commands

```text
cq scan [--repo <campaign>]
cq status
cq log [-n 20]
cq quests
cq quest add|list|show|complete|abandon|check
cq chapters [--repo <campaign>]
cq boss begin|status|complete
cq class list|choose
cq share
cq backup create|list|restore
cq hook install|status|remove
cq profile
cq doctor [--repair]
cq version --verbose
```

## Data locations

CommitQuest follows the XDG base-directory convention:

```text
~/.local/share/commitquest/commitquest.db
~/.local/share/commitquest/backups/
~/.local/share/commitquest/crash-reports/
~/.local/share/commitquest/shares/
~/.config/commitquest/settings.json
```

Set `COMMITQUEST_HOME` to isolate all data, which is also how the test suite runs.

## Design principles

- **Local-first:** repository contents and progress stay on the machine
- **Private by default:** sharing requires an explicit export
- **Celebratory, not judgemental:** Git metrics are game mechanics, not measures of developer quality
- **No streak punishment:** missing a day does not remove XP or achievements
- **No silent release actions:** tags and pushes require explicit user intent
- **Recoverable:** migrations, restores, and TUI failures preserve a path back

## Development

```bash
npm ci
npm run check
```

Current verification target:

```text
TypeScript build
20+ test files
90+ automated tests
CLI smoke tests
npm package dry-run
Nix flake package check in CI
```

## Licence

CommitQuest is released under the [MIT Licence](LICENSE).
