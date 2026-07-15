<div align="center">

# ⚔️ CommitQuest

### Level up by shipping real work.

A local-first Git adventure that turns real development progress into XP, levels, quests, streaks, releases, and achievements.

[![Node.js](https://img.shields.io/badge/Node.js-22.5%2B-111827?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-111827?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Local--first-111827?style=for-the-badge&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-111827?style=for-the-badge)](LICENSE)

</div>

---

## What it feels like

```text
╭──────────────────────────────────────────╮
│  COMMITQUEST                             │
│  Level up by shipping real work.         │
╰──────────────────────────────────────────╯

Aetherelic · developer@example.com

PROGRESS
Level 5 — Repository Ranger
██████████████████░░░░░░░░░░  136/400 XP
1,186 total XP · 264 XP to next level

JOURNEY
4 day current streak · 11 day best
37 commits · 3 campaigns · 2 releases
6 achievements · 8 quests completed

ACTIVE QUESTS
◆ First Step · Daily +25 XP
  ━━━━━━━━━━━━━━  claimed
  Make one meaningful commit today.

◇ Bug Hunt · Weekly +60 XP
  ━━━━━━━───────  1/2
  Land two bug-fix commits this week.
```

CommitQuest is deliberately **not** a developer ranking system. Commit counts and streaks are game mechanics, not measurements of skill or worth.

## Current features

- Track multiple local Git repositories as **campaigns**
- Import commits, commit types, file counts, dates, branches, and tags
- Award XP for conventional and regular commits
- Detect `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style`, and `revert`
- Give tagged releases a major XP reward
- Filter commits by your configured Git email
- Prevent duplicate rewards with SQLite constraints
- Apply diminishing XP and a daily cap to discourage farming
- Generate daily, weekly, and monthly quests
- Award XP for imported history without letting it complete active quests
- Persist completed quest rewards
- Unlock persistent achievements
- Calculate current and longest streaks
- Keep every byte of activity data on your own machine
- Enable live XP rewards immediately after each Git commit
- Create campaign-specific or global custom quests with automatic Git objectives
- Track commit types, releases, manual milestones, XP rewards, and optional deadlines

## Requirements

- Node.js 22.5 or newer
- Git
- A local Git repository with at least one commit

## Install for development

```bash
npm install
npm run check
./scripts/install-local.sh
```

Both commands are installed:

```bash
commitquest --help
cq --help
```

### NixOS one-shot setup

```bash
nix develop
./scripts/install-local.sh
```

## Begin your first campaign

```bash
cq init
cq add ~/Projects/your-project
cq scan
cq status
cq hook install ~/Projects/your-project
```

CommitQuest reads your global Git name and email during `cq init`. You can set them explicitly:

```bash
cq init --name Aetherelic --email you@example.com
```

By default, only commits matching that email earn XP. For a repository where every commit belongs to you but uses mixed test identities:

```bash
cq scan --all-authors
```

Commits and releases created before a campaign was added still earn their normal historical XP and can unlock long-term achievements. They do not advance the current daily, weekly, or monthly quest board; only activity created after `cq add` counts toward active quests.

### Custom campaign quests

Create objectives that begin from the moment the quest is accepted. Existing imported activity establishes the baseline and cannot instantly complete a new custom quest.

```bash
cq quest add "Ship CommitQuest v0.2" \
  --repo commitquest \
  --type release \
  --target 1 \
  --xp 250

cq quest add "Strengthen the test suite" \
  --repo commitquest \
  --type test \
  --target 5 \
  --xp 150 \
  --deadline 2026-08-01
```

Supported automatic objectives are `commit`, `feat`, `fix`, `docs`, `test`, `refactor`, and `release`. Manual milestones are completed explicitly:

```bash
cq quest add "Design the dashboard" --type manual --xp 100
cq quest complete 3
```

Manage the quest board with `cq quest list`, `cq quest show <id>`, and `cq quest abandon <id>`. Automatic quests progress during normal `cq scan` runs and post-commit hook scans.

### Live rewards

Enable the optional post-commit hook for a tracked campaign:

```bash
cq hook install ~/Projects/your-project
```

Your next `git commit` will immediately show earned XP, completed quests, and unlocked achievements without requiring a manual scan. CommitQuest preserves an existing `post-commit` hook behind its wrapper and restores it when you run:

```bash
cq hook remove ~/Projects/your-project
```

## Commands

| Command | Purpose |
|---|---|
| `cq init` | Create or update your local player profile |
| `cq add <path>` | Add a Git repository as a campaign |
| `cq scan` | Import new commits, releases, quests, and achievements |
| `cq status` | Show the main player dashboard |
| `cq log` | Show recently rewarded commits |
| `cq quests` | Open the current quest board |
| `cq quest add <title>` | Create a custom campaign or global quest |
| `cq quest list` | List active and completed custom quests |
| `cq quest show <id>` | Inspect one custom quest |
| `cq quest complete <id>` | Complete a manual milestone |
| `cq quest abandon <id>` | Abandon an active custom quest |
| `cq achievements` | View locked and unlocked achievements |
| `cq repos` | List tracked campaigns |
| `cq profile` | View or change the rewarded Git identity |
| `cq hook install [path]` | Enable automatic rewards after each commit |
| `cq hook status [path]` | Check live-reward hook status |
| `cq hook remove [path]` | Remove the wrapper and restore any original hook |
| `cq doctor` | Check Node, Git, profile, database, and repository health |

## XP rules

| Git event | Base XP |
|---|---:|
| `feat:` | 40 |
| `fix:` | 30 |
| `perf:` | 30 |
| `test:` | 25 |
| `refactor:` | 25 |
| Regular commit | 20 |
| `docs:` | 15 |
| `build:` / `ci:` | 15 |
| `chore:` / `style:` | 10 |
| Tagged release | 150 |

Multi-file commits can receive a small size bonus. Breaking conventional commits receive an additional bonus. Raw line counts are recorded for future insights but do not directly award XP.

The first five commits on a calendar day receive full commit XP, the next five receive half, and later commits receive one quarter. Commit XP is capped at 250 per day. Quest, achievement, and release rewards are separate.

## Local data

CommitQuest stores its SQLite database at:

```text
${XDG_DATA_HOME:-~/.local/share}/commitquest/commitquest.db
```

For isolated testing or portable profiles:

```bash
COMMITQUEST_HOME=/some/folder cq status
```

No account, cloud service, telemetry, or GitHub token is required.

## Architecture

```text
src/
├── commands/       CLI command handlers
├── core/           XP, levels, streaks, quests, achievements
├── data/           SQLite schema and persistence
├── git/            Git process integration and history parsing
├── ui/             Terminal presentation
└── cli.ts          Commander entry point
```

## Roadmap

- Narrative chapters and linked quest chains
- GitHub issue and milestone integration
- Language and project-class progression paths
- Signed local activity snapshots
- A polished local web dashboard and world map
- Optional cross-device encrypted sync
- Plugin API for editors and terminal dashboards

## Philosophy

CommitQuest celebrates consistency and shipping without punishing breaks. It does not shame missed days, compare developers, upload private repository history, or pretend activity metrics equal code quality.

---

<div align="center">

**Your code. Your quests. Your progress.**

</div>
