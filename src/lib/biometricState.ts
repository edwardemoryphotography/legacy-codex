// Biometric state for task ranking. REAL DATA ONLY.
// The only supported source is a local JSON file written by a live bridge
// (WHOOP / Muse / Apple Health). If the file is missing, malformed, or empty,
// this module returns an explicit "unavailable" state with no numeric values
// and no derived readiness score. No mock, fixture, synthetic, or fallback
// biometric values are ever produced.

import * as dotenv from "dotenv";
import { safeReadFile } from "./fs.js";

dotenv.config();

export type ProjectMode = "deep_build" | "creative_edit" | "admin_light" | "recovery";

export interface BiometricStateAvailable {
    available: true;
    recoveryScore: number; // 0-100%
    focusScore: number;    // 0-100%
    readinessScore?: number; // 0-100%, only if supplied by the live source
    projectMode?: ProjectMode;
    sleepDebtHours?: number;
    recommendation?: string;
    source: string;
    updatedAt?: string;
}

export interface BiometricStateUnavailable {
    available: false;
    reason: "missing_file" | "read_error" | "parse_error" | "invalid_schema" | "empty";
    detail: string;
    path: string;
}

export type BiometricState = BiometricStateAvailable | BiometricStateUnavailable;

const STATE_FILE = process.env.BIOMETRICS_STATE_FILE ?? "notes/biometric-state.json";

function clampScore(n: unknown): number | null {
    const x = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(x)) return null;
    return Math.min(100, Math.max(0, Math.round(x)));
}

export async function getCurrentBiometrics(): Promise<BiometricState> {
    let raw: string;
    try {
        raw = await safeReadFile(STATE_FILE);
    } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
            return {
                available: false,
                reason: "missing_file",
                detail: `Biometric state file not found. Connect a live bridge (WHOOP / Muse / Apple Health) that writes to ${STATE_FILE}.`,
                path: STATE_FILE
            };
        }
        return {
            available: false,
            reason: "read_error",
            detail: `Failed to read ${STATE_FILE}: ${err.message}`,
            path: STATE_FILE
        };
    }

    if (!raw || raw.trim() === "") {
        return {
            available: false,
            reason: "empty",
            detail: `${STATE_FILE} is empty. Live biometric data required.`,
            path: STATE_FILE
        };
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
        return {
            available: false,
            reason: "parse_error",
            detail: `Could not parse ${STATE_FILE}: ${(e as Error).message}`,
            path: STATE_FILE
        };
    }

    const recoveryScore = clampScore(parsed.recoveryScore);
    const focusScore = clampScore(parsed.focusScore);

    if (recoveryScore === null || focusScore === null) {
        return {
            available: false,
            reason: "invalid_schema",
            detail: `${STATE_FILE} is missing required numeric fields recoveryScore and/or focusScore.`,
            path: STATE_FILE
        };
    }

    const readinessScoreRaw = parsed.readinessScore;
    const readinessScore = readinessScoreRaw === undefined || readinessScoreRaw === null
        ? undefined
        : clampScore(readinessScoreRaw) ?? undefined;

    const state: BiometricStateAvailable = {
        available: true,
        recoveryScore,
        focusScore,
        source: typeof parsed.source === "string" ? parsed.source : "local-file",
        ...(readinessScore !== undefined ? { readinessScore } : {}),
        ...(typeof parsed.projectMode === "string"
            ? { projectMode: parsed.projectMode as ProjectMode }
            : {}),
        ...(typeof parsed.sleepDebtHours === "number" && Number.isFinite(parsed.sleepDebtHours)
            ? { sleepDebtHours: parsed.sleepDebtHours }
            : {}),
        ...(typeof parsed.recommendation === "string"
            ? { recommendation: parsed.recommendation }
            : {}),
        ...(typeof parsed.updatedAt === "string" ? { updatedAt: parsed.updatedAt } : {})
    };

    console.log(
        `[Biometric Governor] Live state loaded from ${STATE_FILE} -> Recovery: ${state.recoveryScore}%, Focus: ${state.focusScore}%`
    );
    return state;
}
