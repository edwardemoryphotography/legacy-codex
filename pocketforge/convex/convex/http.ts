import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
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
 */
http.route({
  path: "/ai/generate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
        { error: "Missing input. Send { task, input } — e.g. task:\"caption\"." },
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
      return jsonResponse(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      return jsonResponse({ error: message }, 502);
    }
  }),
});

export default http;
