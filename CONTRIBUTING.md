# Contributing to CommitQuest

CommitQuest is local-first developer tooling. Contributions should preserve privacy, avoid manipulative streak mechanics, and keep progression understandable.

## Development

```bash
npm install
npm run check
npm run dev -- --help
```

Use focused conventional commits and add tests for changes to XP, levels, streaks, quests, achievements, Git parsing, or persistence. CommitQuest uses exact prefixes such as `feat:`, `fix:`, `docs:`, and `test:` for typed quest progress, so commit messages should describe the actual patch rather than reuse a generic subject.

You can preview classification before committing:

```bash
cq quest check "feat: add quest guidance" --repo commitquest
```

## Pull requests

Explain the player-facing behaviour, include terminal output where useful, and note any database schema implications. Do not introduce telemetry or remote data transfer without an explicit opt-in design discussion.
