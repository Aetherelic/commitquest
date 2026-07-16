# Changelog

## 1.1.0 — Prism

### Added

- Full-screen Profile card with identity, path title, level, XP, streaks, campaign totals, badges, current objective, and recent momentum
- Matrix, Nord, Rosé Pine, Gruvbox Dark, Dracula, Solarized Dark, Monochrome, Obsidian Ink, Synthwave, Amber Terminal, Iceberg, and Cyberdeck themes
- Theme-owned semantic colours for selections, rewards, warnings, failures, metadata, and secondary emphasis
- Vertical layout distribution that uses tall terminal windows as deliberate breathing room

### Changed

- Redesigned every submenu around section rules, list/detail panes, whitespace, and readable hierarchy
- Removed bulky box grids from Profile, Quests, Campaigns, Chapters, Badges, Progress, Path, Log, Share, and Themes
- Preserved the established welcome screen while adding Profile to the launcher, tabs, and command palette
- Expanded the theme gallery to sixteen curated palettes with live semantic-state previews

### Visual consistency

- Every status colour is sourced from the selected theme; renderers do not inject a global red, green, pink, or highlight
- Matrix stays within layered phosphor greens, Catppuccin uses its own Mocha state colours, and Monochrome remains grayscale
- Primary submenu screens are tested to remain free from heavyweight modal borders
- 25 automated test files and 111 tests cover navigation, layouts, profile rendering, and palette integrity

## 1.0.0 — The Completed Quest

### Added

- Persistent reduced-motion and colour preferences
- `cq settings` for theme and accessibility configuration
- Bash, Zsh, and Fish completion generation through `cq completion`
- `cq privacy` local-data audit with optional JSON output
- Preview-first `cq cleanup` retention for backups and crash reports
- Safe `cq uninstall` lifecycle with progress preserved by default
- Local uninstaller script, manual page, and completion installation
- Cross-file release verification through `npm run verify:release`

### Changed

- Promoted CommitQuest from the Odyssey preview channel to the stable channel
- Nix and local installers now include documentation and shell integration
- Reduced-motion mode disables decorative home-screen animation
- Colour handling now supports auto, always, and never modes

### Stability

- 24 automated test files and 106 tests cover the complete local lifecycle
- Release verification checks version consistency and blocks internal registry URLs
- Cleanup is dry-run by default and uninstallation preserves user data unless explicitly purged

## 0.5.0 — Odyssey

### Added

- Verified backups, restore safety copies, database integrity checks, and schema-version reporting
- Automatic pre-migration database backups
- `cq doctor --repair` and `cq version --verbose`
- Campaign chapters with sequential unlocks and persistent rewards
- Release boss encounters with clean-tree, version, documentation, changelog, test, and tag checks
- Five cosmetic developer classes with activity-driven skill titles
- Privacy-safe SVG, Markdown, and JSON journey exports
- Full-screen Chapters, Developer Path, and Share screens
- TUI crash reports and safe terminal restoration
- Reproducible Nix package and deterministic local installer

### Changed

- Expanded the command palette and clean launcher with chapters, paths, and sharing
- Upgraded the database schema to version 5
- CI now checks Node 22, Node 24, npm packaging, and the Nix package

### Safety

- CommitQuest never pushes release tags automatically
- Default share cards exclude repository names, paths, emails, and commit subjects
- Restores create a safety backup before replacing local data
