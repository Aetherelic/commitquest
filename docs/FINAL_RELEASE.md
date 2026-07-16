# Stable release checklist

CommitQuest 1.0 uses one release verification command:

```bash
npm run verify:release
```

It checks:

- the TypeScript build and complete automated test suite
- the npm package dry-run
- version consistency across `package.json`, `src/version.ts`, `flake.nix`, and `CHANGELOG.md`
- required public project files
- absence of internal npm registry URLs

For the Nix package, also run:

```bash
nix flake check --print-build-logs
nix build .#commitquest
```

Create a final local backup before tagging:

```bash
cq backup create
cq boss begin commitquest 1.0.0
cq boss status commitquest 1.0.0 --run-tests
cq boss complete commitquest 1.0.0 --create-tag
```

CommitQuest never pushes the tag automatically.
