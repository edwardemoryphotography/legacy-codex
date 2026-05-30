import { describe, it, expect, vi, beforeEach } from "vitest";

// gemini.ts throws at module evaluation when GEMINI_API_KEY is absent, so mock
// it before any import resolves. vi.hoisted ensures mock variables are available
// inside the factory without "cannot access before initialization" errors.

const { mockGenerateContent, mockGetModel } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  return { mockGenerateContent, mockGetModel };
});

vi.mock("../lib/gemini.js", () => ({
  getModel: mockGetModel,
  genAI: {},
}));

// safeReadFile loads DELEGATION_RULES_v1.md — mock it to avoid real FS access.
vi.mock("../lib/fs.js", () => ({
  safeReadFile: vi.fn().mockResolvedValue("# Delegation Rules\nRoute everything to Legacy Codex v37."),
  safeWriteFile: vi.fn().mockResolvedValue(undefined),
  safeAppendFile: vi.fn().mockResolvedValue(undefined),
}));

import { routeCapture } from "../agents/routeOmega.js";

describe("routeOmega — routing contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an object with route, reason, nextAction, destination keys from valid Gemini JSON", async () => {
    const payload = {
      route: "Legacy Codex v37",
      reason: "Capture is related to the core project.",
      nextAction: "Add item to TRIAGE_QUEUE.md",
      destination: "notes/TRIAGE_QUEUE.md",
    };

    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(payload) },
    });

    const result = await routeCapture("I need to fix the pricing page");

    expect(result).not.toBeNull();
    const decision = result as Record<string, unknown>;
    expect(decision).toHaveProperty("route");
    expect(decision).toHaveProperty("reason");
    expect(decision).toHaveProperty("nextAction");
    expect(decision).toHaveProperty("destination");
    expect(decision["route"]).toBe("Legacy Codex v37");
  });

  it("handles invalid JSON from Gemini without throwing (graceful error path)", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "THIS IS NOT JSON }{" },
    });

    // routeCapture catches parse errors and returns undefined (no throw).
    const result = await routeCapture("some capture text");
    expect(result).toBeUndefined();
  });

  it("propagates non-retryable Gemini errors upward", async () => {
    mockGenerateContent.mockRejectedValue(new Error("auth failed"));

    await expect(routeCapture("capture text")).rejects.toThrow("auth failed");
  });
});
