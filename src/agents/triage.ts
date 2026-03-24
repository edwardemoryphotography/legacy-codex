import * as fs from "fs/promises";
import * as path from "path";
import { getModel } from "../lib/gemini.ts";
import { safeWriteFile } from "../lib/fs.ts";
import { withRetry } from "../lib/withRetry.ts";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_DIR = path.resolve(__dirname, "../../../notes");
const TRIAGE_QUEUE = path.resolve(__dirname, "../../../notes/TRIAGE_QUEUE.md");

async function runTriage() {
    console.log("[Capture Inbox Triage] Scanning notes/ for unclassified thoughts...");
    let files: string[] = [];
    try {
        files = await fs.readdir(NOTES_DIR);
    } catch (e) {
        console.log("No notes directory found or unable to read.");
        return;
    }

    const unclassifiedFiles = files.filter(f => f.startsWith("capture_") && f.endsWith(".md"));
    if (unclassifiedFiles.length === 0) {
        console.log("No unclassified captures found in notes/.");
        return;
    }

    console.log(`Found ${unclassifiedFiles.length} raw captures. Summarizing...`);
    let triageReport = "## Triage Report - " + new Date().toISOString() + "\n\n";

    for (const file of unclassifiedFiles) {
        const content = await fs.readFile(path.join(NOTES_DIR, file), "utf-8");
        const prompt = `
Summarize this raw capture into a single actionable bullet point.
If it is purely reflective, state "Reflection: [one sentence summary]".

RAW CAPTURE:
${content}
        `;
        
        const model = getModel("gemini-2.5-pro");
        const result = await withRetry(() =>
            model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            })
        );
        
        triageReport += `- **${file}**: ${result.response.text()}\n`;
    }

    await safeWriteFile("notes/TRIAGE_QUEUE.md", triageReport);
    console.log("[Capture Inbox Triage] Triage complete. Appended summary to TRIAGE_QUEUE.md.");
}

import { fileURLToPath } from "url";
import { resolve } from "path";

// Example Execution
const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("triage.ts")) {
    runTriage();
}
