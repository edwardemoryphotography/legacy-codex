// Biometric state for task ranking. Sources: mock (default) or file (real-time bridge writes JSON).

import * as dotenv from "dotenv";
import { safeReadFile } from "./fs.js";

dotenv.config();

export interface BiometricState {
    recoveryScore: number; // 0-100%
    focusScore: number;    // 0-100%
    readinessScore?: number; // 0-100%, derived from recovery + focus + sleep trend when available
    projectMode?: "deep_build" | "creative_edit" | "admin_light" | "recovery";
    sleepDebtHours?: number;
    recommendation?: string;
}

const STATE_FILE = process.env.BIOMETRICS_STATE_FILE ?? "notes/biometric-state.json";

function clampScore(n: unknown, fallback: number): number {
    const x = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(100, Math.max(0, Math.round(x)));
}

async function readBiometricsFromFile(): Promise<BiometricState | null> {
    try {
        const raw = await safeReadFile(STATE_FILE);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
            recoveryScore: clampScore(parsed.recoveryScore, 50),
            focusScore: clampScore(parsed.focusScore, 50),
            readinessScore: parsed.readinessScore === undefined ? undefined : clampScore(parsed.readinessScore, 50),
            projectMode: typeof parsed.projectMode === "string" ? parsed.projectMode as BiometricState["projectMode"] : undefined,
            sleepDebtHours: typeof parsed.sleepDebtHours === "number" ? parsed.sleepDebtHours : undefined,
            recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : undefined
        };
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
            console.warn(
                `[Biometric Governor] BIOMETRICS_SOURCE=file but ${STATE_FILE} is missing. Falling back to mock.`
            );
        } else {
            console.warn(`[Biometric Governor] Failed to read ${STATE_FILE}:`, err.message);
        }
        return null;
    }
}

export async function getCurrentBiometrics(): Promise<BiometricState> {
    const source = (process.env.BIOMETRICS_SOURCE ?? "mock").toLowerCase();

    if (source === "file") {
        console.log(`[Biometric Governor] Reading biometric state from ${STATE_FILE}...`);
        const fromFile = await readBiometricsFromFile();
        if (fromFile) {
            console.log(
                `[Biometric Governor] State retrieved -> Recovery: ${fromFile.recoveryScore}%, Focus: ${fromFile.focusScore}%`
            );
            return fromFile;
        }
    } else {
        console.log("[Biometric Governor] Using mock Whoop/Muse stand-in (set BIOMETRICS_SOURCE=file for live bridge)...");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    const state = {
        recoveryScore: 72,
        focusScore: 88,
        readinessScore: 79,
        projectMode: "creative_edit" as const,
        sleepDebtHours: 3.5,
        recommendation: "Good creative window; avoid unnecessary scope expansion."
    };

    console.log(`[Biometric Governor] State retrieved -> Recovery: ${state.recoveryScore}%, Focus: ${state.focusScore}%`);
    return state;
}
