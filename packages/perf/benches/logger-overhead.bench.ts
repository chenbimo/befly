/**
 * Logger 开销基准（无 I/O 版本）
 *
 * 目标：粗略评估「Logger 参数处理（meta 注入 + sanitize）」的 CPU 开销。
 * 注意：此基准通过 Logger.setMock 避免写文件/写 stdout，因此不衡量 I/O。
 */

import { basename, dirname, join } from "node:path";

import { Logger } from "../../core/lib/logger";
import { createBenchTextOutput } from "../utils/benchTextOutput";

function nsToMs(ns: number): number {
    return ns / 1_000_000;
}

function runCase(options: { name: string; fn: () => void; durationMs: number; warmupMs: number }): { ops: number; durationMs: number; nsPerOp: number } {
    const warmupEnd = Bun.nanoseconds() + options.warmupMs * 1_000_000;
    while (Bun.nanoseconds() < warmupEnd) {
        options.fn();
    }

    let ops = 0;
    const start = Bun.nanoseconds();
    const end = start + options.durationMs * 1_000_000;
    while (Bun.nanoseconds() < end) {
        options.fn();
        ops += 1;
    }

    const durNs = Bun.nanoseconds() - start;
    return { ops: ops, durationMs: nsToMs(durNs), nsPerOp: ops > 0 ? durNs / ops : Infinity };
}

function safeJsonStringify(obj: any): string {
    try {
        return JSON.stringify(obj);
    } catch {
        return "[Unserializable]";
    }
}

async function main(): Promise<void> {
    const benchFilePath = import.meta.path;
    const base = basename(benchFilePath).replace(/\.bench\.ts$/, "");
    const resultFilePath = join(dirname(benchFilePath), `${base}.bench.txt`);

    const output = createBenchTextOutput({ resultFilePath: resultFilePath, writeToTerminal: true, includeEnvHeader: true });

    Logger.configure({
        debug: 1,
        console: 0,
        dir: "./logs",
        maxSize: 10,
        sanitizeDepth: 3,
        sanitizeNodes: 500,
        sanitizeObjectKeys: 100,
        maxStringLen: 100,
        maxArrayItems: 100,
        excludeFields: ["*password*", "*token*", "*secret*"]
    });

    const payload = {
        userId: 123,
        email: "user@example.com",
        password: "SuperSecretPassword-ShouldBeMasked",
        accessToken: "AccessToken-ShouldBeMasked",
        sqlPreview: "SELECT * FROM user WHERE id = 123 AND token = 'xxx'".repeat(8),
        nested: {
            a: 1,
            b: {
                c: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                deep: {
                    secretKey: "SecretKey-ShouldBeMasked",
                    note: "hello".repeat(200)
                }
            }
        }
    };

    const mockLogger = {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined
    };

    output.teeLine(`# ${base}.bench`);
    output.teeLine("(no-IO) comparing Logger.info(obj,msg) with setMock vs baseline JSON.stringify");
    output.teeLine("");

    const cases = [
        {
            name: "Logger.info(obj,msg) (setMock)",
            fn: () => {
                Logger.setMock(mockLogger as any);
                Logger.info(payload as any, "hello");
                Logger.setMock(null);
            }
        },
        {
            name: "JSON.stringify(payload)",
            fn: () => {
                void safeJsonStringify(payload);
            }
        }
    ];

    for (const c of cases) {
        const r = runCase({ name: c.name, fn: c.fn, durationMs: 1200, warmupMs: 200 });
        output.teeLine(`${c.name}: ops=${r.ops}, durationMs=${r.durationMs.toFixed(1)}, ns/op=${r.nsPerOp.toFixed(1)}`);
    }

    await output.close();
}

void main();
