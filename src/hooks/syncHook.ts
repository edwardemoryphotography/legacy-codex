import * as dotenv from "dotenv";
import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs/promises";
import { getModel } from "../lib/gemini.ts";
import { withRetry } from "../lib/withRetry.ts";
import { safeReadFile } from "../lib/fs.ts";

// Load .env.local first (project convention), then fall back to .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERCEL_URL = "https://legacy-codex.vercel.app";
const SCREENSHOT_PATH = path.resolve(__dirname, "../../logs/latest_sync.png");

async function runSyncHook() {
    if (!process.env.GEMINI_API_KEY) {
        console.error(
            "[Production-Intent Sync] GEMINI_API_KEY is missing.\n" +
            "  → Copy .env.example to .env.local and set GEMINI_API_KEY.\n" +
            "  → Get a key at https://aistudio.google.com/app/apikey"
        );
        return;
    }

    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    console.log(`[Production-Intent Sync] Capturing screenshot of ${VERCEL_URL}...`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set a realistic viewport
    await page.setViewport({ width: 1280, height: 800 });

    // If the deployment is behind Vercel Authentication / Deployment Protection,
    // set the bypass header so Puppeteer can reach the page without SSO.
    // Set VERCEL_AUTOMATION_BYPASS_SECRET in .env.local (see .env.example).
    if (bypassSecret) {
        await page.setExtraHTTPHeaders({ "x-vercel-protection-bypass": bypassSecret });
    }

    try {
        const res = await page.goto(VERCEL_URL, { waitUntil: "networkidle2" });
        const status = res?.status() ?? 0;
        if (status === 403 || status === 401) {
            console.error(
                `[Production-Intent Sync] Vercel page returned HTTP ${status}.\n` +
                "  The deployment is protected by Vercel Authentication (team SSO) or\n" +
                "  Deployment Protection. How to fix:\n" +
                "  Option A — Disable protection (simplest for a public site):\n" +
                "    Vercel → Project → Settings → Deployment Protection → disable 'Vercel Authentication'.\n" +
                "  Option B — Add a Protection Bypass secret:\n" +
                "    Vercel → Project → Settings → Deployment Protection → 'Protection Bypass for Automation'.\n" +
                "    Copy the secret, add VERCEL_AUTOMATION_BYPASS_SECRET=<secret> to .env.local,\n" +
                "    then re-run. The script will send the x-vercel-protection-bypass header.\n" +
                "  Option C — Use the Vercel CLI:\n" +
                "    vercel dev  (serves the project locally without auth gating)"
            );
            await browser.close();
            return;
        }
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
        console.log(`Screenshot saved to ${SCREENSHOT_PATH}`);
    } catch (e) {
        console.error("Failed to capture Vercel page:", e);
        await browser.close();
        return;
    }
    await browser.close();

    console.log("[Production-Intent Sync] Analyzing UI vs Intent...");
    
    // In a real scenario, we'd read the most recent feature spec or notes.
    // For this example, we ask a general validation question.
    const expectedIntent = "A modern web application that acts as a central hub or operating system for the Legacy Codex project. It should look complete and functional.";
    
    const imageBuffer = await fs.readFile(SCREENSHOT_PATH);
    const imagePart = {
        inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: "image/png"
        }
    };

    const prompt = `
You are the Production-Intent Sync Hook for Legacy Codex v37.
I am providing a screenshot of the currently deployed Vercel application.
The intended architectural state/behavior is: "${expectedIntent}"

Does the current UI match the intended behavior? Provide a short analysis and state whether it passes or fails the "Sync Check".
    `;

    const model = getModel("gemini-2.5-pro");
    const result = await withRetry(() => model.generateContent([prompt, imagePart]));
    
    console.log("\n[Sync Check Result]");
    console.log(result.response.text());
}

import { resolve } from "path";

// Example Execution
const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("syncHook.ts")) {
    runSyncHook();
}
