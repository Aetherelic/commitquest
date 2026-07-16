import { generateCompletion, type CompletionShell } from "../core/completion.js";

export function completionCommand(shell: CompletionShell): void {
  process.stdout.write(generateCompletion(shell));
}
