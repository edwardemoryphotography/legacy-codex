import * as fs from "fs/promises";
import * as path from "path";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTECTED_FILES = [
    "AGENTS.md",
    "DELEGATION_RULES_v1.md",
    "GEMINI.md"
];

const ROOT_DIR = path.resolve(__dirname, "../../");

export async function safeReadFile(relativePath: string): Promise<string> {
    const fullPath = path.resolve(ROOT_DIR, relativePath);
    return await fs.readFile(fullPath, "utf-8");
}

export async function safeWriteFile(relativePath: string, content: string): Promise<void> {
    if (PROTECTED_FILES.includes(relativePath)) {
        throw new Error(`Execution Engine Error: Cannot write to protected file ${relativePath}`);
    }
    const fullPath = path.resolve(ROOT_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
}

export async function safeAppendFile(relativePath: string, content: string): Promise<void> {
    if (PROTECTED_FILES.includes(relativePath)) {
        throw new Error(`Execution Engine Error: Cannot append to protected file ${relativePath}`);
    }
    const fullPath = path.resolve(ROOT_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, content, "utf-8");
}
