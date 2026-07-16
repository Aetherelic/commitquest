#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

registry="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/}"
prefix="${COMMITQUEST_INSTALL_PREFIX:-$HOME/.local}"
node_path="$(command -v node || true)"

if [[ -z "$node_path" ]]; then
  printf 'Node.js 22.5 or newer is required for the local installer.\n' >&2
  printf 'NixOS users can instead run: nix profile install .#commitquest\n' >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm ci --registry="$registry"
fi

if [[ "${COMMITQUEST_SKIP_CHECK:-0}" != "1" ]]; then
  npm run check
else
  npm run build
fi
npm install --global --force --prefix "$prefix" --registry="$registry" .

package_root="$prefix/lib/node_modules/commitquest"
mkdir -p "$prefix/bin"
rm -f "$prefix/bin/cq" "$prefix/bin/commitquest"

cat > "$prefix/bin/cq" <<WRAPPER
#!/usr/bin/env bash
exec "$node_path" "$package_root/dist/cli.js" "\$@"
WRAPPER
chmod +x "$prefix/bin/cq"
ln -s cq "$prefix/bin/commitquest"

installed_version="$("$prefix/bin/cq" --version)"
expected_version="$(node -p "require('./package.json').version")"
if [[ "$installed_version" != "$expected_version" ]]; then
  printf 'Install verification failed: expected %s, got %s\n' "$expected_version" "$installed_version" >&2
  exit 1
fi

printf '\nCommitQuest %s installed to %s/bin. Start with: cq\n' "$installed_version" "$prefix"
