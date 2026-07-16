# Changelog

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
