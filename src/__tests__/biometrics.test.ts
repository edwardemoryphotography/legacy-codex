import { describe, it, expect, beforeEach, afterEach } from "vitest";

// biometrics.ts honours BIOMETRICS_STATE_FILE env var at module-load time
// (via `process.env` at the top-level const), so we can set it before importing.

describe("getCurrentBiometrics — absence paths (no real biometric data)", () => {
  const ORIGINAL_STATE_FILE = process.env["BIOMETRICS_STATE_FILE"];

  afterEach(() => {
    // Restore original env state
    if (ORIGINAL_STATE_FILE === undefined) {
      delete process.env["BIOMETRICS_STATE_FILE"];
    } else {
      process.env["BIOMETRICS_STATE_FILE"] = ORIGINAL_STATE_FILE;
    }
  });

  it("returns available:false with reason 'missing_file' when the state file does not exist", async () => {
    // Point to a path that is guaranteed not to exist.
    process.env["BIOMETRICS_STATE_FILE"] = "/tmp/__no_such_biometric_file_legacy_codex__.json";

    // Dynamic import so each test gets a fresh module evaluation with the
    // env var already set; the module-level `STATE_FILE` const captures it.
    const { getCurrentBiometrics } = await import(
      "../lib/biometrics.js?bust=" + Date.now()
    );

    const state = await getCurrentBiometrics();
    expect(state.available).toBe(false);
    if (!state.available) {
      expect(state.reason).toBe("missing_file");
      expect(typeof state.detail).toBe("string");
      expect(state.detail.length).toBeGreaterThan(0);
    }
  });

  it("does not throw an unhandled exception when the state file is missing", async () => {
    process.env["BIOMETRICS_STATE_FILE"] = "/tmp/__no_such_biometric_file_legacy_codex_2__.json";

    const { getCurrentBiometrics } = await import(
      "../lib/biometrics.js?bust=" + Date.now()
    );

    // Must resolve (not reject) — all absence cases return a typed value.
    await expect(getCurrentBiometrics()).resolves.toMatchObject({ available: false });
  });
});
