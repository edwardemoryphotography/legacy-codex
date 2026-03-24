import { getModel } from "../lib/gemini.ts";
import { safeReadFile } from "../lib/fs.ts";
import { withRetry } from "../lib/withRetry.ts";

async function routeCapture(captureText: string) {
    console.log(`[Route-Omega] Analyzing capture: "${captureText.substring(0, 50)}..."`);
    
    // Load the manual routing rules to serve as context for the LLM
    const rulesContext = await safeReadFile("DELEGATION_RULES_v1.md");
    
    const prompt = `
You are the Route-Omega Automated Dispatcher for Legacy Codex v37.
Your job is to read a raw thought or voice capture and route it to the correct project lane, strictly following the provided DELEGATION_RULES_v1.md.

### DELEGATION RULES (Context)
${rulesContext}

### RAW CAPTURE
${captureText}

Determine the correct route, the reason, the next physical action, and the destination file.
Respond ONLY in valid JSON format with the following keys:
- "route": The chosen project route (e.g. "Legacy Codex v37", "6-Figure Metal Prints").
- "reason": A one-sentence explanation for the routing decision.
- "nextAction": One visible physical action.
- "destination": The file, queue, or note location.
    `;

    const model = getModel("gemini-2.5-pro");
    const result = await withRetry(() =>
        model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    );

    const responseText = result.response.text();
    try {
        const decision = JSON.parse(responseText);
        console.log("\n[Route-Omega] Routing Decision:");
        console.log(`Route:        ${decision.route}`);
        console.log(`Reason:       ${decision.reason}`);
        console.log(`Next Action:  ${decision.nextAction}`);
        console.log(`Destination:  ${decision.destination}`);
        
        return decision;
    } catch (e) {
        console.error("Failed to parse Route-Omega decision:", responseText);
    }
}

import { fileURLToPath } from "url";
import { resolve } from "path";

// Example Execution
const nodePath = resolve(process.argv[1] || "");
const modulePath = fileURLToPath(import.meta.url);

if (nodePath === modulePath || nodePath.endsWith("routeOmega.ts")) {
    const args = process.argv.slice(2);
    const input = args[0] || "[VOICE-SYNC] I need to figure out the pricing tiers for the new limited edition metal prints before Friday.";
    routeCapture(input);
}
