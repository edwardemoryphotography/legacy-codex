import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../lib/withRetry.js";

describe("withRetry", () => {
  it("calls the operation once when it succeeds on the first attempt", async () => {
    const op = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(op, 3, 0);
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds: a function that fails twice then succeeds is called 3 times total", async () => {
    // Build a retryable error (status 503) so withRetry actually retries.
    const retryableError = Object.assign(new Error("service unavailable"), { status: 503 });

    let callCount = 0;
    const op = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) return Promise.reject(retryableError);
      return Promise.resolve("success");
    });

    const result = await withRetry(op, 3, 0);
    expect(result).toBe("success");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("rejects after max retries when the operation always fails with a retryable error", async () => {
    const retryableError = Object.assign(new Error("overloaded"), { status: 503 });
    const op = vi.fn().mockRejectedValue(retryableError);

    await expect(withRetry(op, 3, 0)).rejects.toThrow();
    // maxRetries=3 → attempts: 0, 1, 2 (3 total calls, then throws on third because
    // attempt >= maxRetries-1)
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors and rethrows immediately", async () => {
    const hardError = new Error("not a capacity error");
    const op = vi.fn().mockRejectedValue(hardError);

    await expect(withRetry(op, 3, 0)).rejects.toThrow("not a capacity error");
    expect(op).toHaveBeenCalledTimes(1);
  });
});
