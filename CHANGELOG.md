# Changelog

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
