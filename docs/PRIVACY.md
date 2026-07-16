# Privacy model

CommitQuest operates locally. It invokes the local `git` executable, stores derived activity in a local SQLite database, and does not contain an upload service.

Default journey exports contain aggregate progress only. They exclude repository paths, repository names, Git email addresses, commit hashes, and commit subjects. Campaign names are added only when `--include-projects` is explicitly supplied.

Post-commit hooks invoke the locally installed CommitQuest CLI and preserve any pre-existing hook through a reversible backup.
