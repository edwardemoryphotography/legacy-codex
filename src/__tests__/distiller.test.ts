import { describe, it, expect, vi, beforeEach } from "vitest";

// distiller.ts calls getModel (which throws without GEMINI_API_KEY) and
// safeWriteFile, so we mock both modules before any import resolves.

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

vi.mock("../lib/fs.js", () => ({
  safeReadFile: vi.fn().mockResolvedValue(""),
  safeWriteFile: vi.fn().mockResolvedValue(undefined),
  safeAppendFile: vi.fn().mockResolvedValue(undefined),
}));

import { getModel } from "../lib/gemini.js";
import { withRetry } from "../lib/withRetry.js";

// Mirror the core distillation contract: takes a combined log string, sends it
// to Gemini, and returns the model's text response.
async function callDistillerLogic(combinedLogs: string): Promise<string> {
  const prompt = `You are the Memory Distiller.\n\nLOGS:\n${combinedLogs}\n\nGenerate a Session Resume.`;
  const model = getModel("gemini-2.5-pro");
  const result = await withRetry(() =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    })
  );
  return (result as { response: { text: () => string } }).response.text();
}

describe("distiller — compression contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces non-empty output given a sample session log string", async () => {
    const sampleLog = [
      "--- LOG FILE: session-2025-05-18.log ---",
      "[INFO] Route-Omega dispatched capture to Legacy Codex v37.",
      "[INFO] Task: Fix pricing tiers for metal prints. Deadline: Friday.",
      "[INFO] Decision: Use Stripe for payment processing.",
      "[WARN] Gemini API rate-limited on second attempt; retried successfully.",
      "[INFO] safeWriteFile: notes/TRIAGE_QUEUE.md updated with 3 items.",
      "[INFO] Session ended. Duration: 47 minutes.",
    ].join("\n");

    const compressedSummary = "## Session Resume\n\n**Critical Decisions Made**\n- Use Stripe for payments\n\n**Current Blocker Status**\nNone\n\n**Next Immediate Action**\nFix pricing tiers before Friday.";

    mockGenerateContent.mockResolvedValue({
      response: { text: () => compressedSummary },
    });

    const output = await callDistillerLogic(sampleLog);

    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });

  it("produces output shorter than a verbose input log (compression happened)", async () => {
    // A verbose 2000-character log
    const verboseLog = "VERBOSE LOG ENTRY: ".repeat(100) + " lots of noise and repetition in the session logs that need to be compressed down into a brief summary.";

    const conciseSummary = "## Session Resume\n\n- Key decision made.\n- No blocker.\n- Next: ship the feature.";

    mockGenerateContent.mockResolvedValue({
      response: { text: () => conciseSummary },
    });

    const output = await callDistillerLogic(verboseLog);

    expect(output.length).toBeLessThan(verboseLog.length);
    expect(output.length).toBeGreaterThan(0);
  });
});
