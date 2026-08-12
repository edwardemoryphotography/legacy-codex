import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Fixed-window rate limiter for public HTTP AI routes.
 * Returns whether the request is allowed under the current window.
 */
export const consume = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    retryAfterMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!existing || now - existing.windowStart >= args.windowMs) {
      if (existing) {
        await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
      } else {
        await ctx.db.insert("rateLimits", {
          key: args.key,
          windowStart: now,
          count: 1,
        });
      }
      return {
        allowed: true,
        remaining: Math.max(0, args.limit - 1),
        retryAfterMs: 0,
      };
    }

    if (existing.count >= args.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, args.windowMs - (now - existing.windowStart)),
      };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return {
      allowed: true,
      remaining: Math.max(0, args.limit - existing.count - 1),
      retryAfterMs: 0,
    };
  },
});
