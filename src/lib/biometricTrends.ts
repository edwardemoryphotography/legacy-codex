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

export interface BiometricTrendState {
    generatedAt: string;
    source: "file" | "fixture";
    summary: BiometricTrendSummary;
    days: BiometricTrendPoint[];
}

const TREND_FILE = process.env.BIOMETRICS_TREND_FILE ?? "notes/biometric-trends.json";
const DAY_MS = 24 * 60 * 60 * 1000;

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

function isoDate(offsetFromToday: number): string {
    return new Date(Date.now() - offsetFromToday * DAY_MS).toISOString().slice(0, 10);
}

export function buildFixtureTrend(days = 30): BiometricTrendPoint[] {
    return Array.from({ length: days }, (_, index) => {
        const reverseIndex = days - index - 1;
        const wave = Math.sin(index / 2.5);
        const recoveryScore = clamp(62 + wave * 18 - (index % 9 === 0 ? 16 : 0));
        const mindfulMinutes = Math.max(0, Math.round(10 + Math.cos(index / 3) * 7 + (index % 6 === 0 ? 20 : 0)));
        const sleepHours = round(6.8 + wave * 0.8 - (index % 7 >= 5 ? 0.6 : 0), 1);

        return {
            date: isoDate(reverseIndex),
            sleepHours,
            mindfulMinutes,
            restingHeartRate: Math.round(58 - wave * 2 + (sleepHours < 6.2 ? 5 : 0)),
            hrvMs: Math.round(61 + wave * 9 + (mindfulMinutes > 20 ? 6 : 0)),
            recoveryScore,
            focusScore: clamp(50 + mindfulMinutes * 1.1 + recoveryScore * 0.28)
        };
    });
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
    const source = (process.env.BIOMETRICS_TRENDS_SOURCE ?? "fixture").toLowerCase();

    if (source === "file") {
        try {
            const raw = await safeReadFile(TREND_FILE);
            const parsed = JSON.parse(raw) as unknown;
            const candidateDays = Array.isArray(parsed)
                ? parsed
                : Array.isArray((parsed as { days?: unknown }).days)
                    ? (parsed as { days: unknown[] }).days
                    : [];
            const days = candidateDays.filter(isTrendPoint).slice(-30);

            if (days.length) {
                return {
                    generatedAt: new Date().toISOString(),
                    source: "file",
                    summary: summarizeTrend(days),
                    days
                };
            }
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            console.warn(`[Biometric Trends] Failed to read ${TREND_FILE}: ${err.message}`);
        }
    }

    const days = buildFixtureTrend(30);
    return {
        generatedAt: new Date().toISOString(),
        source: "fixture",
        summary: summarizeTrend(days),
        days
    };
}
