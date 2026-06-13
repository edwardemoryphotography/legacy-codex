"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import Anthropic from "@anthropic-ai/sdk";
import { Daytona, Sandbox } from "@daytonaio/sdk";

const APP_PORT = 3000;
const APP_DIR = "pocketforge-app";

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

function getDaytona(): Daytona {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) throw new Error("DAYTONA_API_KEY is not set. Run: npx convex env set DAYTONA_API_KEY <key>");
  return new Daytona({ apiKey });
}

function parseFileBlocks(text: string): { files: Map<string, string>; summary: string } {
  const files = new Map<string, string>();
  const fileRegex = /<file path="([^"]+)">\n?([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1].trim().replace(/^\/+/, "");
    // Reject anything that could escape the app directory in the sandbox or contain shell metacharacters.
    if (path.includes("..") || path.length === 0 || !/^[a-zA-Z0-9_\-./]+$/.test(path)) continue;
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

async function ensureSandbox(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  existingSandboxId: string | undefined,
): Promise<Sandbox> {
  const daytona = getDaytona();

  if (existingSandboxId) {
    try {
      const sandbox = await daytona.get(existingSandboxId);
      if (sandbox.state !== "started") {
        await sandbox.start();
      }
      return sandbox;
    } catch {
      // Sandbox was deleted or expired — fall through and create a fresh one.
    }
  }

  const sandbox = await daytona.create({
    public: true,
    autoStopInterval: 0,
    labels: { app: "pocketforge", projectId: projectId as string },
  });
  await ctx.runMutation(internal.projects.patch, { projectId, sandboxId: sandbox.id });
  return sandbox;
}

async function deployFiles(sandbox: Sandbox, files: Map<string, string>): Promise<string> {
  const rootDir = (await sandbox.getUserRootDir()) ?? "/home/daytona";
  const appDir = `${rootDir}/${APP_DIR}`;
  await sandbox.process.executeCommand(`mkdir -p ${appDir}`);

  for (const [path, content] of files) {
    if (path.includes("/")) {
      const dir = path.slice(0, path.lastIndexOf("/"));
      await sandbox.process.executeCommand(`mkdir -p ${appDir}/${dir}`);
    }
    await sandbox.fs.uploadFile(Buffer.from(content, "utf-8"), `${appDir}/${path}`);
  }

  // (Re)start the static file server. Killing first makes the deploy
  // idempotent across rebuilds.
  await sandbox.process.executeCommand(`pkill -f "http.server ${APP_PORT}" || true`);
  const sessionId = `web-${Date.now()}`;
  await sandbox.process.createSession(sessionId);
  await sandbox.process.executeSessionCommand(sessionId, {
    command: `cd ${appDir} && python3 -m http.server ${APP_PORT} --bind 0.0.0.0`,
    runAsync: true,
  });
  // Give the server a moment to bind before handing out the URL.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const preview = await sandbox.getPreviewLink(APP_PORT);
  return preview.url;
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

      await setStatus(ctx, args.projectId, "building", "Spinning up your sandbox…");
      const sandbox = await ensureSandbox(ctx, args.projectId, project.sandboxId);

      await setStatus(ctx, args.projectId, "building", "Deploying to the sandbox…");
      // Deploy the full current file set, not just the changed files, so a
      // recreated sandbox always has everything.
      const allFiles = await ctx.runQuery(internal.files.listInternal, {
        projectId: args.projectId,
      });
      const deploySet = new Map(allFiles.map((f) => [f.path, f.content]));
      const previewUrl = await deployFiles(sandbox, deploySet);

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

// Called when the user opens a project: makes sure the sandbox is awake and
// the preview URL is current (sandboxes can stop or be reclaimed).
export const wake = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId: args.projectId,
    });
    if (!project || !project.sandboxId || project.status !== "live") return null;

    try {
      const sandbox = await ensureSandbox(ctx, args.projectId, project.sandboxId);
      const allFiles = await ctx.runQuery(internal.files.listInternal, {
        projectId: args.projectId,
      });
      const previewUrl = await deployFiles(
        sandbox,
        new Map(allFiles.map((f) => [f.path, f.content])),
      );
      await ctx.runMutation(internal.projects.patch, {
        projectId: args.projectId,
        previewUrl,
        status: "live",
        statusDetail: "Live",
      });
      return { previewUrl };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.projects.patch, {
        projectId: args.projectId,
        status: "error",
        statusDetail: `Could not wake sandbox: ${detail}`,
      });
      return null;
    }
  },
});

// Deletes the sandbox (best effort) and then all project data.
export const destroy = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.getInternal, {
      projectId: args.projectId,
    });
    if (!project) return;

    if (project.sandboxId) {
      try {
        const daytona = getDaytona();
        const sandbox = await daytona.get(project.sandboxId);
        await sandbox.delete();
      } catch {
        // Sandbox already gone — nothing to clean up.
      }
    }
    await ctx.runMutation(internal.projects.removeInternal, { projectId: args.projectId });
  },
});
