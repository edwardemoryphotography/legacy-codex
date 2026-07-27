import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const add = internalMutation({
  args: {
    projectId: v.id("projects"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

// Conversation history for the agent: user/assistant turns only,
// status lines excluded.
export const historyInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return messages.filter((m) => m.role === "user" || m.role === "assistant");
  },
});
