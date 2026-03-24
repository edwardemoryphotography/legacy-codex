import * as fs from "fs/promises";
import * as path from "path";
import { getModel } from "../lib/gemini.ts";
import { safeWriteFile } from "../lib/fs.ts";
import { withRetry } from "../lib/withRetry.ts";
import { fileURLToPath } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correctly resolve logs and notes relative to the script in src/agents
const LOGS_DIR = path.resolve(__dirname, "../../logs");
const NOTES_DIR = path.resolve(__dirname, "../../notes");

async function distillLogs() {
    console.log("[Memory Distiller] Scanning logs/ to compress session context...");
    let files: string[] = [];
    try {
        files = await fs.readdir(LOGS_DIR);
    } catch (e) {
        console.error(`[Error] Could not read logs directory at ${LOGS_DIR}:`, e);
        return;
    }

    const logFiles = files.filter(f => f.endsWith(".log") || f.endsWith(".md"));
    if (logFiles.length === 0) {
        console.log("No logs to distill.");
        return;
    }

    console.log(`Compressing ${logFiles.length} log files...`);
    
    let combinedLogs = "";
    for (const file of logFiles) {
        try {
            const content = await fs.readFile(path.join(LOGS_DIR, file), "utf-8");
            combinedLogs += `\n--- LOG FILE: ${file} ---\n${content.substring(0, 5000)}`;
        } catch (readErr) {
            console.warn(`[Warning] Could not read log file ${file}:`, readErr);
        }
    }

    const prompt = `
You are the Memory Distiller for Legacy Codex v37.
Your task is to analyze these verbose execution logs and extract "Knowledge Nuggets".
Compress thousands of tokens of history into a concise briefing.

LOGS:
${combinedLogs}

Generate a "Session Resume" file formatted in Markdown containing:
1. **Critical Decisions Made**: Bullet points of permanent architectural or routing decisions.
2. **Current Blocker Status**: Based on the logs, what is the single biggest blocker?
3. **Next Immediate Action**: The exact next physical step to restart execution.
    `;

    const model = getModel("gemini-2.5-pro");
    const result = await withRetry(() =>
        model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
    );

    const timestamp = new Date().toISOString().split("T")[0];
    const resumeFileName = `notes/RESUME_${timestamp}.md`;
    
    await safeWriteFile(resumeFileName, result.response.text());
    console.log(`[Memory Distiller] Compression complete. High-signal resume written to ${resumeFileName}`);
}

// Example Execution
const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("distiller.ts")) {
    distillLogs();
}
