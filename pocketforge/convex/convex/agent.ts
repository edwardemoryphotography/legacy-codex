"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are PocketForge, an expert web-app builder living inside a mobile app.
The user describes an app; you produce a complete, polished, working web app.

Output rules — follow them exactly:
1. The app must be a fully self-contained static site. The entry point is index.html.
   No build step, no npm, no server-side code. CDN libraries are allowed
   (Tailwind via https://cdn.tailwindcss.com, React UMD, Chart.js, etc.).
2. Persist data with localStorage where it makes the app feel real.
3. The app is viewed primarily on an iPhone inside a WKWebView. It must be
   mobile-first and gorgeous: include <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">,
   use safe-area insets, large touch targets, and smooth transitions.
   Avoid generic AI aesthetics — use distinctive typography, cohesive color,
   and tasteful micro-interactions.
4. Emit every file inside file blocks, nothing else between them:
   <file path="index.html">
   ...full file content...
   </file>
   Prefer a single index.html; split into styles.css / app.js only when the
   app is genuinely large. Always emit the COMPLETE content of every file you
   output — never diffs, never placeholders, never "rest unchanged".
5. When iterating on an existing app, re-emit only the files that change
   (with their complete new content).
6. After the file blocks, add exactly one block:
   <summary>One or two friendly sentences telling the user what you built or changed.</summary>`;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Run: npx convex env set ANTHROPIC_API_KEY <key>");
  return new Anthropic({ apiKey });
}

function parseFileBlocks(text: string): { files: Map<string, string>; summary: string } {
  const files = new Map<string, string>();
  const fileRegex = /<file path="([^"]+)">\n?([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1].trim().replace(/^\/+/, "");
    // Defense in depth: allowlist characters and reject directory escapes
    // before the path is used anywhere outside this function.
    if (!/^[a-zA-Z0-9_\-./]+$/.test(path) || path.includes("..")) continue;
    files.set(path, match[2].replace(/\n$/, "") + "\n");
  }
  const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(text);
  const summary = summaryMatch ? summaryMatch[1].trim() : "Done! Your app is updated.";
  return { files, summary };
}

async function setStatus(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  status: string,
  statusDetail: string,
) {
  await ctx.runMutation(internal.projects.patch, { projectId, status, statusDetail });
  await ctx.runMutation(internal.messages.add, {
    projectId,
    role: "status",
    content: statusDetail,
  });
}

async function generateFiles(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  userPrompt: string,
): Promise<{ files: Map<string, string>; summary: string }> {
  const history = await ctx.runQuery(internal.messages.historyInternal, { projectId });
  const existingFiles = await ctx.runQuery(internal.files.listInternal, { projectId });

  const turns: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  let finalUserContent = userPrompt;
  if (existingFiles.length > 0) {
    const fileDump = existingFiles
      .map((f) => `<file path="${f.path}">\n${f.content}</file>`)
      .join("\n\n");
    finalUserContent =
      `Current files of the app:\n\n${fileDump}\n\n` +
      `User request: ${userPrompt}\n\n` +
      `Re-emit the complete content of every file that needs to change.`;
  }
  turns.push({ role: "user", content: finalUserContent });

  const anthropic = getAnthropic();
  // Stream to avoid HTTP timeouts on large generations, then collect the
  // final message.
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: turns,
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = parseFileBlocks(text);
  if (parsed.files.size === 0 && existingFiles.length === 0) {
    throw new Error("The agent did not produce any files. Try rephrasing your request.");
  }
  return parsed;
}

// --- Hosting: Vercel static deployments, one Vercel project per app ---

const VERCEL_API = "https://api.vercel.com";

function getVercelToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not set. Run: npx convex env set VERCEL_TOKEN <token>");
  return token;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelFetch(path: string, init?: RequestInit): Promise<Response> {
  return await fetch(`${VERCEL_API}${path}${teamQuery()}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getVercelToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function newHostProjectName(appName: string): string {
  const base =
    appName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `pocketforge-${base}-${suffix}`;
}

async function ensureHostProject(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  appName: string,
  existing: string | undefined,
): Promise<string> {
  if (existing) return existing;
  const hostProjectName = newHostProjectName(appName);
  await ctx.runMutation(internal.projects.patch, { projectId, hostProjectName });
  return hostProjectName;
}

// Creates a production deployment with the files inlined. Vercel
// auto-creates the project on first deploy; framework null = plain static
// hosting, immune to framework misdetection.
async function deployFiles(hostProjectName: string, files: Map<string, string>): Promise<string> {
  const response = await vercelFetch("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: hostProjectName,
      target: "production",
      projectSettings: { framework: null },
      files: Array.from(files.entries()).map(([file, data]) => ({
        file,
        data,
        encoding: "utf-8",
      })),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vercel deploy failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const deployment = (await response.json()) as { id: string; url: string };

  // Static deploys are ready in seconds; poll so we never hand the app a
  // URL that isn't serving yet.
  for (let attempt = 0; attempt < 60; attempt++) {
    const poll = await vercelFetch(`/v13/deployments/${deployment.id}`);
    if (poll.ok) {
      const { readyState } = (await poll.json()) as { readyState?: string };
      if (readyState === "READY") return `https://${deployment.url}`;
      if (readyState === "ERROR" || readyState === "CANCELED") {
        throw new Error(`Vercel deployment ended in state ${readyState}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Timed out waiting for the Vercel deployment to become ready");
}

// Main entry point: builds the app initially and handles every follow-up
// request from the agent chat. `prompt` is the user's message.
export const build = action({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");

    await ctx.runMutation(internal.messages.add, {
      projectId: args.projectId,
      role: "user",
      content: args.prompt,
    });

    try {
      await setStatus(ctx, args.projectId, "building", "Designing your app with Claude…");
      const { files, summary } = await generateFiles(ctx, args.projectId, args.prompt);

      for (const [path, content] of files) {
        await ctx.runMutation(internal.files.upsert, {
          projectId: args.projectId,
          path,
          content,
        });
      }

      await setStatus(ctx, args.projectId, "building", "Publishing to the web…");
      const hostProjectName = await ensureHostProject(
        ctx,
        args.projectId,
        project.name,
        project.hostProjectName,
      );
      // Deploy the full current file set, not just the changed files, so
      // every deployment is complete and self-contained.
      const allFiles = await ctx.runQuery(internal.files.listInternal, {
        projectId: args.projectId,
      });
      const previewUrl = await deployFiles(
        hostProjectName,
        new Map(allFiles.map((f) => [f.path, f.content])),
      );

      await ctx.runMutation(internal.projects.patch, {
        projectId: args.projectId,
        status: "live",
        statusDetail: "Live",
        previewUrl,
      });
      await ctx.runMutation(internal.messages.add, {
        projectId: args.projectId,
        role: "assistant",
        content: summary,
      });
      return { previewUrl };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.projects.patch, {
        projectId: args.projectId,
        status: "error",
        statusDetail: detail,
      });
      await ctx.runMutation(internal.messages.add, {
        projectId: args.projectId,
        role: "status",
        content: `Build failed: ${detail}`,
      });
      throw error;
    }
  },
});

// Called when the user opens a project. Vercel deployments never sleep, so
// this just hands back the current URL — kept as an action so the iOS app's
// open-project flow stays the same.
export const wake = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ previewUrl: string } | null> => {
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId: args.projectId,
    });
    if (!project || !project.previewUrl) return null;
    return { previewUrl: project.previewUrl };
  },
});

// Deletes the Vercel project (best effort) and then all project data.
export const destroy = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId: args.projectId,
    });
    if (!project) return;

    if (project.hostProjectName) {
      try {
        await vercelFetch(`/v9/projects/${encodeURIComponent(project.hostProjectName)}`, {
          method: "DELETE",
        });
      } catch {
        // Project already gone — nothing to clean up.
      }
    }
    await ctx.runMutation(internal.projects.removeInternal, { projectId: args.projectId });
  },
});
