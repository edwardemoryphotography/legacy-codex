import * as dotenv from "dotenv";
import { safeReadFile, safeWriteFile } from "../lib/fs.ts";

dotenv.config();

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

type DeploymentRecord = {
    state?: string;
    url?: string;
    createdAt?: number;
    meta?: Record<string, string>;
    name?: string;
};

function gitHintsFromMeta(meta: Record<string, string> | undefined): string {
    if (!meta || Object.keys(meta).length === 0) {
        return "(no Git metadata on deployment — may be CLI upload or older integration; use Vercel UI → deployment → Source)";
    }
    const sha =
        meta.githubCommitSha ||
        meta.gitCommitSha ||
        meta.commitSha ||
        meta.sha ||
        "";
    const ref =
        meta.githubCommitRef ||
        meta.gitCommitRef ||
        meta.branch ||
        meta.githubCommitMessage?.slice(0, 60) ||
        "";
    const repo = meta.githubRepo || meta.githubOrg ? `${meta.githubOrg ?? ""}/${meta.githubRepo ?? ""}`.replace(/^\//, "") : "";
    const lines = [
        ref && `ref/branch: ${ref}`,
        sha && `commit: ${sha}`,
        repo && `repo hint: ${repo}`
    ].filter(Boolean);
    return lines.length ? lines.join("\n  ") : `meta keys: ${Object.keys(meta).slice(0, 12).join(", ")}`;
}

async function checkDeployments() {
    console.log("[Vercel Truth Bridge] Latest **production** deployment for linked project...\n");

    if (!VERCEL_TOKEN) {
        console.warn("VERCEL_TOKEN not found in environment variables. Skipping check.");
        return;
    }

    if (!VERCEL_PROJECT_ID) {
        console.error(
            "[Vercel Truth Bridge] VERCEL_PROJECT_ID is missing. Set it to the Project ID from Vercel → Project → Settings → General (starts with prj_)."
        );
        return;
    }

    try {
        let url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(VERCEL_PROJECT_ID)}&target=production&limit=1`;
        if (VERCEL_TEAM_ID) url += `&teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`
            }
        });

        const raw = await response.text();
        let data: { error?: { code?: string; message?: string }; deployments?: DeploymentRecord[] } = {};
        try {
            data = JSON.parse(raw) as typeof data;
        } catch {
            console.error(`[Vercel Truth Bridge] Non-JSON response (HTTP ${response.status}): ${raw.slice(0, 200)}`);
            return;
        }

        if (response.status === 401 || response.status === 403) {
            const msg = data.error?.message ?? raw.slice(0, 200);
            console.error(`[Vercel Truth Bridge] Not authorized (HTTP ${response.status}): ${msg}`);
            console.error(
                "Fix: Create a new token at https://vercel.com/account/tokens — scope must allow this project. If the project lives under a Team, set VERCEL_TEAM_ID (Team Settings → Team ID) and use a token with team access."
            );
            return;
        }

        if (!response.ok) {
            console.error(
                `[Vercel Truth Bridge] HTTP ${response.status}: ${data.error?.message ?? raw.slice(0, 200)}`
            );
            return;
        }

        if (data.error) {
            if (data.error.code === "forbidden" || data.error.code === "not_found") {
                console.error(`[Vercel Truth Bridge] Authorization Error: ${data.error.message}`);
                console.error("- Ensure your VERCEL_TOKEN is valid and has access to the project.");
                console.error("- Ensure VERCEL_PROJECT_ID is the 'prj_...' ID from your Vercel Project Settings (not the project name).");
                if (VERCEL_TEAM_ID) {
                    console.error("- Check if VERCEL_TEAM_ID is correct (team ID starts with 'team_...').");
                } else {
                    console.error("- If your project is in a Vercel Team, you must provide a VERCEL_TEAM_ID.");
                }
            } else {
                console.error(`[Vercel Truth Bridge] API Error: ${data.error.message}`);
            }
            return;
        }

        if (!data.deployments || data.deployments.length === 0) {
            console.log(
                `[Vercel Truth Bridge] No production deployments found for project ${VERCEL_PROJECT_ID}. Check project ID and team ID in Vercel UI.`
            );
            return;
        }

        const d = data.deployments[0];
        const created = d.createdAt ? new Date(d.createdAt).toISOString() : "?";
        console.log("--- Production truth (from Vercel API) ---");
        console.log(`State:     ${d.state ?? "?"}`);
        console.log(`URL:       ${d.url ?? "?"}`);
        console.log(`Created:   ${created}`);
        console.log(`Git:       ${gitHintsFromMeta(d.meta)}`);
        console.log("---");
        console.log("Copy branch + SHA into notes/VERCEL_PRODUCTION_REF.md so local work has a fixed anchor.\n");

        if (d.state === "READY" && process.env.VERCEL_BRIDGE_CLEAR_BLOCKER === "1") {
            const blockerContext = await safeReadFile("SHIPPING_BLOCKER.txt");
            if (blockerContext.trim() !== "No current blocker.") {
                console.log("[Vercel Truth Bridge] VERCEL_BRIDGE_CLEAR_BLOCKER=1 → clearing SHIPPING_BLOCKER.txt.");
                await safeWriteFile("SHIPPING_BLOCKER.txt", "No current blocker.");
            }
        }
    } catch (error) {
        console.error("Failed to check Vercel deployments:", error);
    }
}

import { fileURLToPath } from "url";
import { resolve } from "path";

const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("vercelBridge.ts")) {
    checkDeployments();
}
