import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
      "**/.commitquest-backups/**",
      "**/source-backups/**"
    ],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
