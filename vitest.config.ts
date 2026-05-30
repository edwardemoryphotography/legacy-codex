import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Each test file runs in its own isolate so module-level side-effects
    // (e.g. the GEMINI_API_KEY throw in gemini.ts) can be mocked per file.
    isolate: true,
  },
});
