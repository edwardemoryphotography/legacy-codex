import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per app the user builds. No auth — the app has a single
  // implicit user, so projects are global.
  projects: defineTable({
    name: v.string(),
    prompt: v.string(),
    // draft | building | live | error
    status: v.string(),
    // Short human-readable line shown under the status pill while building.
    statusDetail: v.optional(v.string()),
    // Name of the Vercel project that hosts this app's deployments.
    hostProjectName: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    // SF Symbol name picked client-side for a bit of personality.
    icon: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  // Agent conversation per project. role: user | assistant | status.
  // "status" rows render as small centered progress lines in the app.
  messages: defineTable({
    projectId: v.id("projects"),
    role: v.string(),
    content: v.string(),
  }).index("by_project", ["projectId"]),

  // Source files of the generated web app, mirrored from the sandbox so
  // the iOS code browser can show them instantly.
  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_path", ["projectId", "path"]),
});
