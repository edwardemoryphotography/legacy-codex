import * as fs from "fs/promises";
import * as path from "path";
import { getCurrentBiometrics } from "../lib/biometrics.ts";
import { getModel } from "../lib/gemini.ts";
import { safeReadFile, safeWriteFile } from "../lib/fs.ts";
import { withRetry } from "../lib/withRetry.ts";

async function rankTasks() {
    console.log("[Task Ranker] Initializing EEG-Synchronized Task Ranker...");
    
    // 1. Get Biometrics (REAL DATA ONLY — no mocks or fallbacks)
    const biometrics = await getCurrentBiometrics();
    if (!biometrics.available) {
        console.warn(
            `[Task Ranker] Biometric data unavailable (${biometrics.reason}): ${biometrics.detail}`
        );
        console.warn(
            "[Task Ranker] Refusing to rank without live biometrics. Connect a live bridge that writes notes/biometric-state.json, then retry."
        );
        return;
    }

    // 2. Load the current triage queue / backlog
    let backlogContext = "No tasks in queue.";
    try {
        backlogContext = await safeReadFile("notes/TRIAGE_QUEUE.md");
    } catch {
        console.log(
            "No notes/TRIAGE_QUEUE.md found. Create it (see backlog bullets), or add notes/capture_*.md and run npm run triage."
        );
        return;
    }

    if (!backlogContext || backlogContext.trim() === "") {
        console.log("Backlog is empty.");
        return;
    }

    console.log("[Task Ranker] Re-evaluating task priority based on cognitive state...");

    const prompt = `
You are the EEG-Synchronized Task Ranker for Legacy Codex v37.
Your job is to reprioritize the user's task backlog based on their current biometric state.

CURRENT BIOMETRIC STATE:
- Whoop Recovery: ${biometrics.recoveryScore}%
- Muse Focus: ${biometrics.focusScore}%

RULES:
- If Focus is HIGH (>80%), push complex architectural or creative tasks to the top.
- If Recovery is LOW (<50%), push administrative, maintenance, or "tiny step" tasks to the top.
- Remove completed or irrelevant tasks.

CURRENT BACKLOG:
${backlogContext}

Output the re-ordered backlog in Markdown format. Provide a one-sentence rationale at the top explaining the sorting strategy based on the biometrics.
    `;

    const model = getModel("gemini-2.5-pro");
    const result = await withRetry(() =>
        model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
    );

    const outputText = result.response.text();
    
    // Overwrite the queue with the ranked version
    await safeWriteFile("notes/TRIAGE_QUEUE.md", outputText);
    
    console.log("\n[Task Ranker] Ranking complete. Queue updated.");
    console.log("Rationale:");
    // Print just the first few lines to show the rationale
    console.log(outputText.split('\n').slice(0, 3).join('\n'));
}

import { fileURLToPath } from "url";
import { resolve } from "path";

// Example Execution
const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("taskRanker.ts")) {
    rankTasks();
}
