import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

import { Logger } from "../lib/logger";

function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const mm = m < 10 ? `0${m}` : String(m);
    const dd = d < 10 ? `0${d}` : String(d);
    return `${y}-${mm}-${dd}`;
}

const testRootDir = join(process.cwd(), "temp", "test-logs-rotate");
const testDir = join(testRootDir, String(Date.now()));

beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
    // 先 flush/close，避免 Windows 句柄占用
    await Logger.shutdown();

    if (existsSync(testRootDir)) {
        rmSync(testRootDir, { recursive: true, force: true });
    }
});

describe("Logger - 文件轮转", () => {
    test("按大小滚动：应生成 .1.log", async () => {
        await Logger.shutdown();

        Logger.configure({
            dir: testDir,
            console: 0,
            debug: 1,
            // MB：0.001 ~ 1KB，方便触发滚动
            maxSize: 0.001
        });

        const payload = "x".repeat(900);
        for (let i = 0; i < 50; i += 1) {
            Logger.info({ i: i, payload: payload }, "rotate");
        }

        await Logger.shutdown();

        const date = formatLocalDate(new Date());
        const base = `app.${date}.log`;
        const rotated = `app.${date}.1.log`;

        const basePath = join(testDir, base);
        expect(existsSync(basePath)).toBe(true);

        const files = await readdir(testDir);
        expect(files.includes(rotated)).toBe(true);
    });
});
