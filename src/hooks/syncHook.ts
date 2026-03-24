import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs/promises";
import { getModel } from "../lib/gemini.ts";
import { withRetry } from "../lib/withRetry.ts";
import { safeReadFile } from "../lib/fs.ts";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERCEL_URL = "https://legacy-codex.vercel.app";
const SCREENSHOT_PATH = path.resolve(__dirname, "../../logs/latest_sync.png");

async function runSyncHook() {
    console.log(`[Production-Intent Sync] Capturing screenshot of ${VERCEL_URL}...`);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set a realistic viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        await page.goto(VERCEL_URL, { waitUntil: "networkidle2" });
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
