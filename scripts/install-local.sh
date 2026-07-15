#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm install
npm run check
npm install --global --prefix "$HOME/.local" .

printf '\nCommitQuest installed to ~/.local/bin. Start with: cq init\n'
