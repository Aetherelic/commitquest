export type CompletionShell = "bash" | "zsh" | "fish";

export const COMPLETION_SHELLS = ["bash", "zsh", "fish"] as const;

const TOP_LEVEL = [
  "init", "add", "scan", "status", "repos", "campaigns", "log", "quests", "quest",
  "achievements", "profile", "hook", "play", "ui", "backup", "version", "chapters",
  "boss", "class", "share", "settings", "privacy", "cleanup", "completion", "uninstall", "doctor"
];

const SUBCOMMANDS: Record<string, string[]> = {
  quest: ["add", "list", "check", "show", "complete", "abandon"],
  hook: ["install", "remove", "status"],
  backup: ["create", "list", "restore"],
  boss: ["begin", "status", "complete"],
  class: ["list", "choose"]
};

function bashCompletion(): string {
  return `# CommitQuest bash completion\n_commitquest_complete() {\n  local cur prev command\n  COMPREPLY=()\n  cur="\${COMP_WORDS[COMP_CWORD]}"\n  prev="\${COMP_WORDS[COMP_CWORD-1]}"\n  command="\${COMP_WORDS[1]}"\n\n  if [[ \${COMP_CWORD} -eq 1 ]]; then\n    COMPREPLY=( $(compgen -W "${TOP_LEVEL.join(" ")}" -- "$cur") )\n    return\n  fi\n\n  case "$command" in\n${Object.entries(SUBCOMMANDS).map(([command, values]) => `    ${command}) COMPREPLY=( $(compgen -W "${values.join(" ")}" -- "$cur") ) ;;`).join("\n")}\n  esac\n}\ncomplete -F _commitquest_complete cq commitquest\n`;
}

function zshCompletion(): string {
  const commands = TOP_LEVEL.map((command) => `    '${command}:${command.replaceAll("-", " ")}'`).join("\n");
  return `#compdef cq commitquest\n\n_commitquest() {\n  local -a commands\n  commands=(\n${commands}\n  )\n  _describe 'command' commands\n}\n\n_commitquest "$@"\n`;
}

function fishCompletion(): string {
  const lines = TOP_LEVEL.map((command) => `complete -c cq -c commitquest -n '__fish_use_subcommand' -a '${command}'`).join("\n");
  return `# CommitQuest fish completion\n${lines}\n`;
}

export function generateCompletion(shell: CompletionShell): string {
  switch (shell) {
    case "bash": return bashCompletion();
    case "zsh": return zshCompletion();
    case "fish": return fishCompletion();
  }
}
