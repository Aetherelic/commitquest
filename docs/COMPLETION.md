# Shell completion

CommitQuest can print completion scripts without editing shell configuration automatically.

## Bash

```bash
mkdir -p ~/.local/share/bash-completion/completions
cq completion bash > ~/.local/share/bash-completion/completions/cq
```

## Zsh

```bash
mkdir -p ~/.local/share/zsh/site-functions
cq completion zsh > ~/.local/share/zsh/site-functions/_cq
```

Add `~/.local/share/zsh/site-functions` to `fpath` before `compinit` when it is not already included.

## Fish

```bash
mkdir -p ~/.config/fish/completions
cq completion fish > ~/.config/fish/completions/cq.fish
```

The Nix package installs all three completion definitions automatically.
