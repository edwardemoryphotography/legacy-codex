import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./withRetry.ts";

const NO_DELAY = 0;

test("returns result immediately on first successful attempt", async () => {
    const result = await withRetry(() => Promise.resolve(42), 3, NO_DELAY);
    assert.equal(result, 42);
});

test("retries on HTTP 503 and succeeds on later attempt", async () => {
    let calls = 0;
    const result = await withRetry(() => {
        calls++;
        if (calls < 3) {
            return Promise.reject(Object.assign(new Error("Service Unavailable"), { status: 503 }));
        }
        return Promise.resolve("ok");
    }, 3, NO_DELAY);
    assert.equal(result, "ok");
    assert.equal(calls, 3);
});

test("retries on HTTP 429 rate-limit error", async () => {
    let calls = 0;
    const result = await withRetry(() => {
        calls++;
        if (calls < 2) {
            return Promise.reject(Object.assign(new Error("Too Many Requests"), { status: 429 }));
        }
        return Promise.resolve("done");
    }, 3, NO_DELAY);
    assert.equal(result, "done");
    assert.equal(calls, 2);
});

test("retries on RESOURCE_EXHAUSTED message", async () => {
    let calls = 0;
    const result = await withRetry(() => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("RESOURCE_EXHAUSTED quota exceeded"));
        return Promise.resolve("done");
    }, 3, NO_DELAY);
    assert.equal(result, "done");
    assert.equal(calls, 2);
});

test("retries on 'overloaded' message", async () => {
    let calls = 0;
    const result = await withRetry(() => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("The model is overloaded. Please try again later."));
        return Promise.resolve("done");
    }, 3, NO_DELAY);
    assert.equal(result, "done");
    assert.equal(calls, 2);
});

test("does not retry on non-retryable errors (e.g. 404)", async () => {
    let calls = 0;
    await assert.rejects(
        () => withRetry(() => {
            calls++;
            return Promise.reject(Object.assign(new Error("Not Found"), { status: 404 }));
        }, 3, NO_DELAY)
    );
    assert.equal(calls, 1);
});

test("throws after exhausting all retries", async () => {
    let calls = 0;
    await assert.rejects(
        () => withRetry(() => {
            calls++;
            return Promise.reject(Object.assign(new Error("overloaded"), { status: 503 }));
        }, 3, NO_DELAY)
    );
    assert.equal(calls, 3);
});

test("retries on ECONNRESET code", async () => {
    let calls = 0;
    const result = await withRetry(() => {
        calls++;
        if (calls < 2) {
            return Promise.reject(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));
        }
        return Promise.resolve("recovered");
    }, 3, NO_DELAY);
    assert.equal(result, "recovered");
    assert.equal(calls, 2);
});
