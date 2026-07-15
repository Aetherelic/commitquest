#!/usr/bin/env node

const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const warningText = warning instanceof Error ? warning.message : warning;
  const warningName = warning instanceof Error
    ? warning.name
    : typeof args[0] === "string"
      ? args[0]
      : "";

  if (warningName === "ExperimentalWarning" && warningText.includes("SQLite")) {
    return;
  }

  return (originalEmitWarning as (...values: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;

await import("./main.js");
