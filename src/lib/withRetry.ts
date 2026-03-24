/**
 * Runs an async operation with exponential backoff when the Gemini / Google API
 * returns capacity or rate-limit style errors (503, 429, RESOURCE_EXHAUSTED).
 *
 * Usage: `const result = await withRetry(() => model.generateContent(req));`
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 2000
): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: unknown) {
            if (!isRetryableCapacityError(error) || attempt >= maxRetries - 1) {
                throw error;
            }
            attempt++;
            const delay = baseDelayMs * 2 ** (attempt - 1);
            console.warn(
                `[withRetry] Transient API limit. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error("[withRetry] Operation failed after max retries.");
}

function isRetryableCapacityError(error: unknown): boolean {
    if (error === null || typeof error !== "object") {
        return false;
    }
    const e = error as Record<string, unknown>;
    const status = e.status ?? e.statusCode;
    if (status === 503 || status === 429) {
        return true;
    }
    const message = String(e.message ?? "");
    if (
        message.includes("503") ||
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("overloaded")
    ) {
        return true;
    }
    const code = e.code;
    if (code === 503 || code === 429 || code === "ECONNRESET") {
        return true;
    }
    return false;
}
