"use node";

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Model IDs are overridable via Convex env vars so you can point each provider
// at whatever your account has access to (e.g. `npx convex env set OPENAI_MODEL gpt-5.1`).
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";

// Reject missing keys and common placeholders (e.g. literal "sk-ant-..." pasted
// from docs) so we fall through to the next provider instead of a 401.
export function configuredApiKey(envKey: string): string | null {
  const raw = process.env[envKey];
  if (raw == null) return null;
  const key = raw.trim();
  if (key.length < 20) return null;
  const lower = key.toLowerCase();
  if (
    lower.includes("your-") ||
    lower.includes("replace") ||
    lower.endsWith("...") ||
    lower === "sk-ant-..." ||
    lower === "sk-..." ||
    lower.includes("example") ||
    lower.includes("placeholder")
  ) {
    return null;
  }
  return key;
}

export function providerAuthHint(envKey: string): string {
  return (
    `${envKey} is missing or invalid. Set a real key on this Convex deployment: ` +
    `npx convex env set ${envKey} <key> --deployment scintillating-loris-226`
  );
}

function classifyProviderError(envKey: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /invalid x-api-key|authentication_error|incorrect api key|invalid_api_key|401/i.test(
      msg,
    )
  ) {
    return providerAuthHint(envKey);
  }
  return msg;
}

// A provider-neutral chat turn. Each provider maps these onto its own SDK shape.
export type Turn = { role: "user" | "assistant"; content: string };

export type Provider = {
  name: string;
  envKey: string;
  run: (system: string, turns: Turn[], maxTokens: number) => Promise<string>;
};

async function anthropicText(system: string, turns: Turn[], maxTokens: number): Promise<string> {
  const apiKey = configuredApiKey("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error(providerAuthHint("ANTHROPIC_API_KEY"));
  const anthropic = new Anthropic({ apiKey });
  try {
    const stream = anthropic.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    });
    const message = await stream.finalMessage();
    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch (err) {
    throw new Error(classifyProviderError("ANTHROPIC_API_KEY", err));
  }
}

async function openaiText(system: string, turns: Turn[], maxTokens: number): Promise<string> {
  const apiKey = configuredApiKey("OPENAI_API_KEY");
  if (!apiKey) throw new Error(providerAuthHint("OPENAI_API_KEY"));
  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        ...turns.map((t) => ({ role: t.role, content: t.content })),
      ],
    });
    return completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new Error(classifyProviderError("OPENAI_API_KEY", err));
  }
}

async function geminiText(system: string, turns: Turn[], maxTokens: number): Promise<string> {
  const apiKey = configuredApiKey("GEMINI_API_KEY");
  if (!apiKey) throw new Error(providerAuthHint("GEMINI_API_KEY"));
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    const result = await model.generateContent({
      contents: turns.map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.content }],
      })),
    });
    return result.response.text();
  } catch (err) {
    throw new Error(classifyProviderError("GEMINI_API_KEY", err));
  }
}

// Fallback order: Claude first, then OpenAI, then Gemini. A provider is only
// attempted if its API key is configured (and not a placeholder).
export const PROVIDERS: Provider[] = [
  { name: `Claude (${ANTHROPIC_MODEL})`, envKey: "ANTHROPIC_API_KEY", run: anthropicText },
  { name: `GPT (${OPENAI_MODEL})`, envKey: "OPENAI_API_KEY", run: openaiText },
  { name: `Gemini (${GEMINI_MODEL})`, envKey: "GEMINI_API_KEY", run: geminiText },
];

export function providersForPreference(preference: string | undefined): Provider[] {
  const pref = (preference ?? "auto").toLowerCase();
  const keyed = (envKey: string) => !!configuredApiKey(envKey);
  if (pref === "anthropic") {
    return PROVIDERS.filter((p) => p.envKey === "ANTHROPIC_API_KEY" && keyed(p.envKey));
  }
  if (pref === "openai") {
    return PROVIDERS.filter((p) => p.envKey === "OPENAI_API_KEY" && keyed(p.envKey));
  }
  if (pref === "gemini") {
    return PROVIDERS.filter((p) => p.envKey === "GEMINI_API_KEY" && keyed(p.envKey));
  }
  return PROVIDERS.filter((p) => keyed(p.envKey));
}

/** Run the provider fallback chain once; first success wins. */
export async function runChain(
  system: string,
  turns: Turn[],
  maxTokens: number,
  preferredProvider?: string,
): Promise<string> {
  const available = preferredProvider
    ? providersForPreference(preferredProvider)
    : PROVIDERS.filter((p) => !!configuredApiKey(p.envKey));
  if (available.length === 0) {
    throw new Error(
      "No model provider configured. Set at least one real key via " +
        "`npx convex env set ANTHROPIC_API_KEY <key>` (or OPENAI_API_KEY / GEMINI_API_KEY) " +
        "on deployment scintillating-loris-226. Placeholder values like sk-ant-... are ignored.",
    );
  }
  const failures: string[] = [];
  for (const provider of available) {
    try {
      return await provider.run(system, turns, maxTokens);
    } catch (err) {
      failures.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All providers failed — ${failures.join(" · ")}`);
}
