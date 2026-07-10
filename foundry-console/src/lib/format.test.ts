import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, timeAgo } from "./format";

describe("formatDate", () => {
  it("keeps date-only values on the same UTC calendar day", () => {
    expect(formatDate("2026-07-09")).toBe("Jul 9, 2026");
  });

  it("returns an em dash for an absent date", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("uses a deterministic locale and UTC timezone", () => {
    expect(formatDateTime("2026-07-09T15:30:00.000Z")).toBe(
      "Jul 9, 3:30 PM UTC"
    );
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-07-09T16:00:00.000Z");

  it("uses an injected clock at the minute boundary", () => {
    expect(timeAgo("2026-07-09T15:59:01.000Z", now)).toBe("just now");
    expect(timeAgo("2026-07-09T15:59:00.000Z", now)).toBe("1m ago");
  });

  it("does not report future timestamps as negative time", () => {
    expect(timeAgo("2026-07-09T16:00:30.000Z", now)).toBe("just now");
  });
});
