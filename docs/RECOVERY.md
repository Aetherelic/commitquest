# Recovery and backups

CommitQuest stores its SQLite database in the XDG data directory and automatically creates a complete database-file backup before schema migrations.

## Create a backup

```bash
cq backup
```

## Inspect backups

```bash
cq backup list
```

## Restore

```bash
cq backup restore <backup-id> --yes
cq backup restore latest --yes
```

Before replacing the current database, CommitQuest creates a `pre-restore` safety backup. The restored database is reopened, migrated if required, and checked with SQLite's integrity checker.

## Repair

```bash
cq doctor --repair
```

Repair mode:

1. Secures CommitQuest data directories.
2. Creates a verified safety backup.
3. Checkpoints the SQLite WAL.
4. Reinstalls managed live-reward hooks for valid active campaigns.
5. Records the repair timestamp.

It does not guess missing repository paths or delete tracking data.


## Retention cleanup

Cleanup is a preview unless `--apply` is provided:

```bash
cq cleanup
cq cleanup --apply --keep-backups 10 --keep-crashes 20
```

Generated share files are never removed by cleanup.
