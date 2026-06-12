import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    prompt: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", {
      name: args.name,
      prompt: args.prompt,
      icon: args.icon,
      status: "draft",
      updatedAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const patch = internalMutation({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.string()),
    statusDetail: v.optional(v.string()),
    hostProjectName: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(projectId, updates);
  },
});

// Removes the project row and all of its messages/files. The Vercel
// project itself is torn down by the `agent:destroy` action, which calls
// this afterwards.
export const removeInternal = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const message of messages) await ctx.db.delete(message._id);

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const file of files) await ctx.db.delete(file._id);

    await ctx.db.delete(args.projectId);
  },
});
