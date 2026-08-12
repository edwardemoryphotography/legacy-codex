"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { runChain } from "./providers";

const CAPTION_SYSTEM = `You write real social-media captions for photos and posts.
Return ONLY a JSON array of strings (3–5 captions). No prose, no markdown fences.
Each caption should feel specific and human — not generic influencer filler.
Vary tone across the set (e.g. short punchy, storytelling, witty).
Include hashtags only when they fit naturally; never spam #goldenhour-style clichés.`;

function parseCaptionList(text: string): string[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  try {
    const arr = JSON.parse(t) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 8);
  } catch {
    // Fall back: split non-empty lines if the model ignored JSON.
    return t
      .split("\n")
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 12)
      .slice(0, 5);
  }
}

function buildUserPrompt(args: {
  task: string;
  input: string;
  style?: string;
  count?: number;
}): string {
  const count = Math.min(Math.max(args.count ?? 4, 1), 8);
  const style = (args.style ?? "").trim();
  const styleLine = style.length > 0 ? `Style / vibe: ${style}\n` : "";
  const task = args.task.toLowerCase();

  if (task === "caption" || task === "captions") {
    return (
      `${styleLine}` +
      `Write ${count} distinct captions for this photo/post:\n\n${args.input}`
    );
  }

  if (task === "hashtags") {
    return (
      `${styleLine}` +
      `Suggest ${count} short caption+hashtag variants for:\n\n${args.input}`
    );
  }

  return (
    `${styleLine}` +
    `Task: ${args.task}\n` +
    `Respond with useful copy the user can paste. If multiple options help, ` +
    `return a JSON array of strings; otherwise return a JSON array with one string.\n\n` +
    `Input:\n${args.input}`
  );
}

/**
 * Runtime AI for forged apps (captions, copy, etc.). Called from the public
 * HTTP route so static WKWebView apps can fetch real model output instead of
 * shipping hardcoded demo strings.
 */
export const generate = action({
  args: {
    task: v.string(),
    input: v.string(),
    style: v.optional(v.string()),
    count: v.optional(v.number()),
  },
  returns: v.object({
    text: v.string(),
    items: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    const input = args.input.trim();
    if (input.length < 1) {
      throw new Error("input is required");
    }
    if (input.length > 8000) {
      throw new Error("input is too long (max 8000 characters)");
    }

    const task = args.task.trim().toLowerCase() || "caption";
    const system =
      task === "caption" || task === "captions" || task === "hashtags"
        ? CAPTION_SYSTEM
        : `You help PocketForge-built apps generate real text for the user. ` +
          `Return ONLY a JSON array of strings. No markdown fences.`;

    const raw = await runChain(
      system,
      [{ role: "user", content: buildUserPrompt({ ...args, task, input }) }],
      1200,
    );
    const items = parseCaptionList(raw);
    if (items.length === 0) {
      throw new Error("Model returned no usable text — try again.");
    }
    return {
      text: items[0],
      items,
    };
  },
});
