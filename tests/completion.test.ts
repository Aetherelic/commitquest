import { describe, expect, it } from "vitest";
import { generateCompletion } from "../src/core/completion.js";

describe("shell completion", () => {
  it("generates bash completion for the stable command set", () => {
    const output = generateCompletion("bash");
    expect(output).toContain("complete -F _commitquest_complete cq commitquest");
    expect(output).toContain("privacy");
    expect(output).toContain("cleanup");
    expect(output).toContain("uninstall");
    expect(output).toContain("boss) ");
  });

  it("generates zsh and fish definitions", () => {
    expect(generateCompletion("zsh")).toContain("#compdef cq commitquest");
    expect(generateCompletion("fish")).toContain("complete -c cq -c commitquest");
  });
});
