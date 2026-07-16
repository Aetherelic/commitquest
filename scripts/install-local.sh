#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

registry="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"
prefix="${COMMITQUEST_INSTALL_PREFIX:-$HOME/.local}"

if [[ ! -d node_modules ]]; then
  npm install --registry="$registry"
fi

npm run check

mkdir -p "$prefix/bin"
chmod +x dist/cli.js
rm -f "$prefix/bin/cq" "$prefix/bin/commitquest"
ln -s "$(pwd)/dist/cli.js" "$prefix/bin/cq"
ln -s "$(pwd)/dist/cli.js" "$prefix/bin/commitquest"

printf '\nCommitQuest installed to %s/bin. Start with: cq\n' "$prefix"
