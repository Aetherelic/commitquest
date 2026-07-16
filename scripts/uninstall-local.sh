#!/usr/bin/env bash
set -euo pipefail

prefix="${COMMITQUEST_INSTALL_PREFIX:-$HOME/.local}"
purge_data=0
confirmed=0

for argument in "$@"; do
  case "$argument" in
    --purge-data) purge_data=1 ;;
    --yes) confirmed=1 ;;
    -h|--help)
      printf 'Usage: %s [--yes] [--purge-data]\n' "$0"
      printf 'Removes the local CommitQuest package. User data is preserved by default.\n'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$argument" >&2; exit 2 ;;
  esac
done

if [[ "$confirmed" != "1" ]]; then
  printf 'Refusing to uninstall without --yes.\n' >&2
  exit 1
fi

rm -f "$prefix/bin/cq" "$prefix/bin/commitquest"
rm -rf "$prefix/lib/node_modules/commitquest"
rm -f \
  "$prefix/share/bash-completion/completions/cq" \
  "$prefix/share/zsh/site-functions/_cq" \
  "$prefix/share/fish/vendor_completions.d/cq.fish" \
  "$prefix/share/man/man1/commitquest.1" \
  "$prefix/share/man/man1/cq.1"

if [[ "$purge_data" == "1" ]]; then
  rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/commitquest"
  rm -rf "${XDG_CONFIG_HOME:-$HOME/.config}/commitquest"
  printf 'CommitQuest and its local data were removed.\n'
else
  printf 'CommitQuest was removed. Local progress and settings were preserved.\n'
fi
