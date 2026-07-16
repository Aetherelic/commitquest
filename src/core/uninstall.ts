import fs from "node:fs";
import path from "node:path";
import { getConfigDirectory, getDataDirectory } from "../data/paths.js";

export interface LocalInstallation {
  prefix: string;
  packageRoot: string;
  cqPath: string;
  commitquestPath: string;
}

export interface UninstallResult {
  removedApplication: boolean;
  removedData: boolean;
  preservedDataDirectory: string;
  preservedConfigDirectory: string;
}

export function detectLocalInstallation(executable = process.argv[1] ?? ""): LocalInstallation | null {
  if (!executable) return null;
  let resolved: string;
  try { resolved = fs.realpathSync(executable); } catch { resolved = path.resolve(executable); }
  if (resolved.startsWith("/nix/store/")) return null;

  const marker = `${path.sep}lib${path.sep}node_modules${path.sep}commitquest${path.sep}`;
  const markerIndex = resolved.indexOf(marker);
  if (markerIndex < 0) return null;
  const prefix = resolved.slice(0, markerIndex);
  const packageRoot = path.join(prefix, "lib", "node_modules", "commitquest");
  return {
    prefix,
    packageRoot,
    cqPath: path.join(prefix, "bin", "cq"),
    commitquestPath: path.join(prefix, "bin", "commitquest")
  };
}

function removeIfOwned(file: string, installation: LocalInstallation): void {
  if (!fs.existsSync(file) && !fs.lstatSync(path.dirname(file), { throwIfNoEntry: false })) return;
  try {
    const target = fs.realpathSync(file);
    if (target === installation.cqPath || target.startsWith(installation.packageRoot)) fs.rmSync(file, { force: true });
  } catch {
    fs.rmSync(file, { force: true });
  }
}

export function uninstallLocalInstallation(
  installation: LocalInstallation,
  options: { purgeData?: boolean } = {}
): UninstallResult {
  removeIfOwned(installation.commitquestPath, installation);
  removeIfOwned(installation.cqPath, installation);
  fs.rmSync(installation.packageRoot, { recursive: true, force: true });
  for (const generated of [
    path.join(installation.prefix, "share", "bash-completion", "completions", "cq"),
    path.join(installation.prefix, "share", "zsh", "site-functions", "_cq"),
    path.join(installation.prefix, "share", "fish", "vendor_completions.d", "cq.fish"),
    path.join(installation.prefix, "share", "man", "man1", "commitquest.1"),
    path.join(installation.prefix, "share", "man", "man1", "cq.1")
  ]) fs.rmSync(generated, { force: true });

  let removedData = false;
  if (options.purgeData) {
    fs.rmSync(getDataDirectory(), { recursive: true, force: true });
    fs.rmSync(getConfigDirectory(), { recursive: true, force: true });
    removedData = true;
  }

  return {
    removedApplication: true,
    removedData,
    preservedDataDirectory: getDataDirectory(),
    preservedConfigDirectory: getConfigDirectory()
  };
}
