import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeTrend } from "./biometricTrends.ts";
import type { BiometricTrendPoint } from "./biometricTrends.ts";

function makeDay(overrides: Partial<BiometricTrendPoint> = {}): BiometricTrendPoint {
    return {
        date: "2026-01-01",
        sleepHours: 8,
        mindfulMinutes: 20,
        restingHeartRate: 60,
        hrvMs: 50,
        recoveryScore: 70,
        focusScore: 65,
        ...overrides,
    };
}

function nDays(n: number, overrides: Partial<BiometricTrendPoint> = {}): BiometricTrendPoint[] {
    return Array.from({ length: n }, (_, i) =>
        makeDay({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, ...overrides })
    );
}

test("recovery mode when readiness < 42 (low recovery + focus)", () => {
    // recovery=20, focus=20, sleep=5: readiness = 20*0.48 + 20*0.32 + min(100,60)*0.2 = 9.6+6.4+12 = 28
    const result = summarizeTrend(nDays(7, { recoveryScore: 20, focusScore: 20, sleepHours: 5 }));
    assert.equal(result.projectMode, "recovery");
});

test("recovery mode when sleep < 6 regardless of readiness score", () => {
    // sleep=5 triggers the sleep < 6 branch
    const result = summarizeTrend(nDays(7, { recoveryScore: 80, focusScore: 80, sleepHours: 5 }));
    assert.equal(result.projectMode, "recovery");
});

test("admin_light mode when readiness is between 42 and 58", () => {
    // recovery=40, focus=40, sleep=8: readiness = 40*0.48 + 40*0.32 + min(100,96)*0.2 = 19.2+12.8+19.2 = 51
    const result = summarizeTrend(nDays(7, { recoveryScore: 40, focusScore: 40, sleepHours: 8 }));
    assert.equal(result.projectMode, "admin_light");
});

test("creative_edit mode when focus > recovery + 12", () => {
    // recovery=60, focus=85, sleep=8: readiness=75 (>=58); focus(85) > recovery(60)+12
    const result = summarizeTrend(nDays(7, { recoveryScore: 60, focusScore: 85, sleepHours: 8 }));
    assert.equal(result.projectMode, "creative_edit");
});

test("deep_build mode when readiness >= 58 and focus is not dominant", () => {
    // recovery=80, focus=80, sleep=8: readiness high, focus not > recovery+12
    const result = summarizeTrend(nDays(7, { recoveryScore: 80, focusScore: 80, sleepHours: 8 }));
    assert.equal(result.projectMode, "deep_build");
});

test("readinessScore is clamped between 0 and 100", () => {
    const result = summarizeTrend(nDays(7, { recoveryScore: 100, focusScore: 100, sleepHours: 10 }));
    assert.ok(result.readinessScore >= 0 && result.readinessScore <= 100, `readinessScore=${result.readinessScore} out of range`);
});

test("uses only the last 7 days when given more input", () => {
    // 10 low-recovery days followed by 7 high-recovery days — result must reflect the 7 high days
    const low = nDays(10, { recoveryScore: 10, focusScore: 10, sleepHours: 4 });
    const high = nDays(7, { recoveryScore: 85, focusScore: 80, sleepHours: 8 });
    const result = summarizeTrend([...low, ...high]);
    assert.equal(result.projectMode, "deep_build");
});

test("sleepDebtHours is non-negative", () => {
    const result = summarizeTrend(nDays(7, { sleepHours: 9 }));
    assert.ok(result.sleepDebtHours >= 0, `sleepDebtHours=${result.sleepDebtHours} is negative`);
});

test("recoveryScore and focusScore in result are clamped integers", () => {
    const result = summarizeTrend(nDays(7, { recoveryScore: 75, focusScore: 80, sleepHours: 8 }));
    assert.ok(Number.isInteger(result.recoveryScore));
    assert.ok(Number.isInteger(result.focusScore));
    assert.ok(result.recoveryScore >= 0 && result.recoveryScore <= 100);
    assert.ok(result.focusScore >= 0 && result.focusScore <= 100);
});
