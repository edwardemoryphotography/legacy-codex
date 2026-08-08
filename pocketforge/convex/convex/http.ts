import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// Public CORS is intentional: forged static apps in WKWebView call this
// endpoint. Abuse control is rate-limit + input size, not origin lock.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Soft cap: 30 generations / 10 minutes / client IP (or shared fallback key). */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_INPUT_CHARS = 8000;
const MAX_BODY_BYTES = 16_384;

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function clientKey(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return `ip:${cf}`;
  // No IP available (rare) — bucket everyone without one together.
  return "ip:unknown";
}

http.route({
  path: "/ai/generate",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }),
});

/**
 * Public AI helper for forged static apps.
 *
 * POST https://scintillating-loris-226.convex.site/ai/generate
 * Body: { "task": "caption", "input": "...", "style"?: "...", "count"?: 4 }
 * Returns: { "text": "...", "items": ["...", ...] }
 *
 * Abuse controls: per-IP rate limit, body size cap, input length cap.
 */
http.route({
  path: "/ai/generate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request body too large" }, 413);
    }

    const rate = await ctx.runMutation(internal.rateLimit.consume, {
      key: clientKey(request),
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });
    if (!rate.allowed) {
      const retrySec = Math.max(1, Math.ceil(rate.retryAfterMs / 1000));
      return jsonResponse(
        {
          error: `Rate limit exceeded. Try again in ~${retrySec}s.`,
        },
        429,
        {
          "Retry-After": String(retrySec),
          "X-RateLimit-Remaining": "0",
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Expected a JSON object" }, 400);
    }

    const record = body as Record<string, unknown>;
    const task = typeof record.task === "string" ? record.task : "caption";
    const input =
      typeof record.input === "string"
        ? record.input
        : typeof record.prompt === "string"
          ? record.prompt
          : typeof record.description === "string"
            ? record.description
            : "";
    const style = typeof record.style === "string" ? record.style : undefined;
    const count =
      typeof record.count === "number" && Number.isFinite(record.count)
        ? record.count
        : undefined;

    if (!input.trim()) {
      return jsonResponse(
        {
          error:
            'Missing input. Send { task, input } — e.g. task:"caption".',
        },
        400,
      );
    }
    if (input.length > MAX_INPUT_CHARS) {
      return jsonResponse(
        { error: `input is too long (max ${MAX_INPUT_CHARS} characters)` },
        400,
      );
    }

    try {
      const result = await ctx.runAction(api.ai.generate, {
        task,
        input,
        style,
        count,
      });
      return jsonResponse(result, 200, {
        "X-RateLimit-Remaining": String(rate.remaining),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      return jsonResponse({ error: message }, 502);
    }
  }),
});

export default http;
