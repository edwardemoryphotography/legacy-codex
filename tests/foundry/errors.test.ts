import { describe, expect, it } from "vitest";
import {
  firstResultError,
  getErrorMessage,
} from "../../foundry-console/src/lib/errors";

describe("firstResultError", () => {
  it("returns the first Supabase result error", () => {
    const permissionError = { message: "Permission denied" };

    expect(
      firstResultError([
        { error: null },
        { error: permissionError },
        { error: { message: "Later failure" } },
      ])
    ).toBe(permissionError);
  });

  it("returns null when every query succeeded", () => {
    expect(firstResultError([{ error: null }, { error: null }])).toBeNull();
  });
});

describe("getErrorMessage", () => {
  it("preserves Error messages", () => {
    expect(getErrorMessage(new Error("Network unavailable"))).toBe(
      "Network unavailable"
    );
  });

  it("preserves Supabase-style error messages", () => {
    expect(getErrorMessage({ message: "Row-level security denied access" })).toBe(
      "Row-level security denied access"
    );
  });

  it("uses a safe fallback for unknown failures", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });
});
