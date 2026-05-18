import { test } from "node:test";
import assert from "node:assert/strict";
import { safeWriteFile, safeAppendFile } from "./fs.ts";

const PROTECTED_FILES = ["AGENTS.md", "DELEGATION_RULES_v1.md", "GEMINI.md"];

for (const file of PROTECTED_FILES) {
    test(`safeWriteFile throws on protected file: ${file}`, async () => {
        await assert.rejects(
            () => safeWriteFile(file, "should not be written"),
            (err: Error) => {
                assert.ok(err.message.includes("Cannot write to protected file"));
                assert.ok(err.message.includes(file));
                return true;
            }
        );
    });

    test(`safeAppendFile throws on protected file: ${file}`, async () => {
        await assert.rejects(
            () => safeAppendFile(file, "should not be appended"),
            (err: Error) => {
                assert.ok(err.message.includes("Cannot append to protected file"));
                assert.ok(err.message.includes(file));
                return true;
            }
        );
    });
}

test("safeWriteFile does not throw for a non-protected path", async () => {
    const tmpPath = `notes/_test_tmp_${Date.now()}.md`;
    try {
        await safeWriteFile(tmpPath, "# test");
    } finally {
        // clean up
        const { unlink } = await import("node:fs/promises");
        const { resolve } = await import("node:path");
        const { fileURLToPath } = await import("node:url");
        const { dirname } = await import("node:path");
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const fullPath = resolve(__dirname, "../../", tmpPath);
        await unlink(fullPath).catch(() => undefined);
    }
});
