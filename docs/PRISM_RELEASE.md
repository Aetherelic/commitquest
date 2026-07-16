# CommitQuest 1.1 — Prism

Prism is the visual-coherence release. It keeps the established welcome screen and redesigns every working screen as a readable full-terminal application rather than a grid of ASCII boxes.

## Interface system

- Profile is a full journey card with identity, level, path, streaks, campaigns, objectives, badges, and momentum.
- Quests, Campaigns, Chapters, Badges, Progress, Path, Log, Share, and Themes use section rules, whitespace, list/detail panes, and semantic emphasis.
- Tall terminals distribute spacing between content groups so information is not crushed into the top of the window.
- Modal borders remain reserved for temporary overlays such as confirmations, forms, and reward moments.

## Palette contract

The renderer only requests semantic roles: accent, secondary accent, success, attention, danger, muted text, surfaces, and borders. Every selected theme supplies all of those roles. No renderer injects a universal red, green, pink, or cyan.

The sixteen curated themes are Tokyo Night, Arcane, Catppuccin Mocha, Everforest, Matrix, Nord, Rosé Pine, Gruvbox Dark, Dracula, Solarized Dark, Monochrome, Obsidian Ink, Synthwave, Amber Terminal, Iceberg, and Cyberdeck.

## Verification

The test suite verifies the complete theme list, unique identifiers, valid semantic colours, theme-specific state colours, the Profile screen, terminal bounds, and the absence of bulky box borders from primary submenu layouts.
