import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Befly } from "../index";
import { Logger } from "../lib/logger";

describe("Befly.start - failure observability", () => {
    test("启动早期失败时：应记录错误、flush/shutdown、并把异常抛给上层", async () => {
        const prevCwd = process.cwd();

        const runId = String(Date.now());
        const tempProjectDir = join(prevCwd, "temp", `start-fail-project-${runId}`);
        const configsDir = join(tempProjectDir, "configs");
        const commonConfigPath = join(configsDir, "befly.common.json");

        if (!existsSync(configsDir)) {
            mkdirSync(configsDir, { recursive: true });
        }

        // 触发 loadBeflyConfig 的强校验错误：redis.prefix 不允许包含 ':'
        const invalidConfig = {
            redis: {
                prefix: "bad:prefix"
            }
        };
        writeFileSync(commonConfigPath, JSON.stringify(invalidConfig, null, 4), { encoding: "utf8" });

        let flushCalls = 0;
        let shutdownCalls = 0;
        let errorCalls = 0;

        const originalFlush = Logger.flush;
        const originalShutdown = Logger.shutdown;

        const mock: any = {
            info() {
                return;
            },
            warn() {
                return;
            },
            debug() {
                return;
            },
            error() {
                errorCalls = errorCalls + 1;
                return;
            }
        };

        try {
            process.chdir(tempProjectDir);

            // 让 Logger.error 不触发文件 I/O；同时我们只关心 start() 是否调用了 flush/shutdown
            Logger.setMock(mock);

            (Logger as any).flush = async () => {
                flushCalls = flushCalls + 1;
            };
            (Logger as any).shutdown = async () => {
                shutdownCalls = shutdownCalls + 1;
            };

            const app = new Befly();

            let thrown: any = null;
            try {
                await app.start(`test_start_fail_${runId}`);
            } catch (error: any) {
                thrown = error;
            }

            expect(thrown instanceof Error).toBe(true);
            expect(String(thrown?.message || "")).toContain("redis.prefix");

            expect(errorCalls).toBe(1);
            expect(flushCalls).toBe(1);
            expect(shutdownCalls).toBe(1);
        } finally {
            Logger.setMock(null);
            (Logger as any).flush = originalFlush;
            (Logger as any).shutdown = originalShutdown;

            process.chdir(prevCwd);

            if (existsSync(tempProjectDir)) {
                rmSync(tempProjectDir, { recursive: true, force: true });
            }
        }
    });
});
