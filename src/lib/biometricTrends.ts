// Biometric trend state. REAL DATA ONLY.
// Trends are loaded from a local JSON file written by a live bridge
// (Apple Health / WHOOP / Muse). If the file is missing, malformed, or
// contains no valid day records, this module returns an explicit
// "unavailable" state with no numeric values, no synthesized days, and
// no derived readiness / summary. There are no fixtures, mocks, samples,
// or fallbacks — the Biometric Governor must only ever render real data.

import * as dotenv from "dotenv";
import { safeReadFile } from "./fs.js";

dotenv.config();

export type ProjectMode = "deep_build" | "creative_edit" | "admin_light" | "recovery";

export interface BiometricTrendPoint {
    date: string;
    sleepHours: number;
    mindfulMinutes: number;
    restingHeartRate: number;
    hrvMs: number;
    recoveryScore: number;
    focusScore: number;
}

export interface BiometricTrendSummary {
    readinessScore: number;
    recoveryScore: number;
    focusScore: number;
    sleepDebtHours: number;
    projectMode: ProjectMode;
    recommendation: string;
}

export interface BiometricTrendAvailable {
    available: true;
    generatedAt: string;
    source: "file";
    summary: BiometricTrendSummary;
    days: BiometricTrendPoint[];
}

export interface BiometricTrendUnavailable {
    available: false;
    reason: "missing_file" | "read_error" | "parse_error" | "empty" | "no_valid_days";
    detail: string;
    path: string;
}

export type BiometricTrendState = BiometricTrendAvailable | BiometricTrendUnavailable;

const TREND_FILE = process.env.BIOMETRICS_TREND_FILE ?? "notes/biometric-trends.json";

function clamp(n: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, Math.round(n)));
}

function round(n: number, digits = 1): number {
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
}

function average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeTrend(days: BiometricTrendPoint[]): BiometricTrendSummary {
    const recent = days.slice(-7);
    const recovery = average(recent.map((day) => day.recoveryScore));
    const focus = average(recent.map((day) => day.focusScore));
    const sleep = average(recent.map((day) => day.sleepHours));
    const readinessScore = clamp(recovery * 0.48 + focus * 0.32 + Math.min(100, sleep * 12) * 0.2);
    const sleepDebtHours = round(Math.max(0, 7.7 - sleep) * 7, 1);

    if (readinessScore < 42 || sleep < 6) {
        return {
            readinessScore,
            recoveryScore: clamp(recovery),
            focusScore: clamp(focus),
            sleepDebtHours,
            projectMode: "recovery",
            recommendation: "Recovery lane: capture ideas, avoid irreversible architecture, and protect sleep."
        };
    }

    if (readinessScore < 58) {
        return {
            readinessScore,
            recoveryScore: clamp(recovery),
            focusScore: clamp(focus),
            sleepDebtHours,
            projectMode: "admin_light",
            recommendation: "Admin-light lane: triage, docs, small deploy checks, and no scope expansion."
        };
    }

    if (focus > recovery + 12) {
        return {
            readinessScore,
            recoveryScore: clamp(recovery),
            focusScore: clamp(focus),
            sleepDebtHours,
            projectMode: "creative_edit",
            recommendation: "Creative edit lane: shape assets and workshop material while avoiding heavy refactors."
        };
    }

    return {
        readinessScore,
        recoveryScore: clamp(recovery),
        focusScore: clamp(focus),
        sleepDebtHours,
        projectMode: "deep_build",
        recommendation: "Deep-build lane: architecture, implementation, and launch work are appropriate."
    };
}

function isTrendPoint(value: unknown): value is BiometricTrendPoint {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return typeof row.date === "string" &&
        Number.isFinite(Number(row.sleepHours)) &&
        Number.isFinite(Number(row.recoveryScore)) &&
        Number.isFinite(Number(row.focusScore));
}

export async function getBiometricTrends(): Promise<BiometricTrendState> {
    let raw: string;
    try {
        raw = await safeReadFile(TREND_FILE);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
            return {
                available: false,
                reason: "missing_file",
                detail: `Biometric trend file not found. Connect a live bridge that writes normalized metrics to ${TREND_FILE}.`,
                path: TREND_FILE
            };
        }
        return {
            available: false,
            reason: "read_error",
            detail: `Failed to read ${TREND_FILE}: ${err.message}`,
            path: TREND_FILE
        };
    }

    if (!raw || raw.trim() === "") {
        return {
            available: false,
            reason: "empty",
            detail: `${TREND_FILE} is empty. Live biometric data required.`,
            path: TREND_FILE
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return {
            available: false,
            reason: "parse_error",
            detail: `Could not parse ${TREND_FILE}: ${(error as Error).message}`,
            path: TREND_FILE
        };
    }

    const candidateDays = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { days?: unknown }).days)
            ? (parsed as { days: unknown[] }).days
            : [];
    const days = candidateDays.filter(isTrendPoint).slice(-30);

    if (!days.length) {
        return {
            available: false,
            reason: "no_valid_days",
            detail: `${TREND_FILE} contained no valid day records (need date, sleepHours, recoveryScore, focusScore).`,
            path: TREND_FILE
        };
    }

    return {
        available: true,
        generatedAt: new Date().toISOString(),
        source: "file",
        summary: summarizeTrend(days),
        days
    };
}
