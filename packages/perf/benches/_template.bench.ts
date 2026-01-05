/**
 * 基准模板（无第三方依赖版本）
 *
 * 约定：
 * - 基准脚本放在 packages/perf/benches，文件名以 .bench.ts 结尾
 * - 输出文件名：<base>.bench.txt
 */

import { basename, dirname, join } from "node:path";

import { createBenchTextOutput } from "../utils/benchTextOutput";

function nsToMs(ns: number): number {
    return ns / 1_000_000;
}

function runCase(options: { name: string; fn: () => void; durationMs: number; warmupMs: number }): { ops: number; durationMs: number; nsPerOp: number } {
    // warmup
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

async function main(): Promise<void> {
    const benchFilePath = import.meta.path;
    const base = basename(benchFilePath).replace(/\.bench\.ts$/, "");
    const resultFilePath = join(dirname(benchFilePath), `${base}.bench.txt`);

    const output = createBenchTextOutput({ resultFilePath: resultFilePath, writeToTerminal: true, includeEnvHeader: true });

    output.teeLine(`# ${base}.bench`);

    const cases = [
        {
            name: "example",
            fn: () => {
                // do something
                void 0;
            }
        }
    ];

    for (const c of cases) {
        const r = runCase({ name: c.name, fn: c.fn, durationMs: 1000, warmupMs: 200 });
        output.teeLine(`${c.name}: ops=${r.ops}, durationMs=${r.durationMs.toFixed(1)}, ns/op=${r.nsPerOp.toFixed(1)}`);
    }

    await output.close();
}

void main();
