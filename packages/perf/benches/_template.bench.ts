import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bench, group, run } from "mitata";

import { collectRatioRowsFromMitataResult, createBenchTextOutput, formatRatioSummaryTable } from "../utils/benchTextOutput.ts";

// ============================================================================
// 用法：
// 1) 复制本文件并重命名为你的基准文件：xxx.bench.ts
// 2) 在下面的 group/bench 中填入你的测试逻辑
// 3) 运行：bun ./benches/xxx.bench.ts
// 4) 结果会自动落盘到同目录：xxx.bench.txt（终端彩色输出 + 文件剥离 ANSI）
// ============================================================================

const _benchFilePath = fileURLToPath(import.meta.url);
const _benchDir = dirname(_benchFilePath);
const _benchFileName = basename(_benchFilePath);
const _benchBaseName = _benchFileName.endsWith(".bench.ts") ? _benchFileName.slice(0, -".bench.ts".length) : _benchFileName.replace(/\.ts$/u, "");
const _resultFilePath = join(_benchDir, `${_benchBaseName}.bench.txt`);

const output = createBenchTextOutput({
    resultFilePath: _resultFilePath,
    writeToTerminal: true,
    includeEnvHeader: true
});

// ============================================================================
// 参数矩阵示例（推荐）：
// - 用 size/参数组合自动生成多个 group
// - 你的 bench 里通常只需要改：sizes / variants / bench 的实现体
// ============================================================================

const sizes = [1_000, 10_000];

const variants = [{ label: "baseline" }, { label: "variant" }];

for (const size of sizes) {
    const input = Array.from({ length: size }, (_, i) => i);

    for (const variant of variants) {
        group(`size=${size} | ${variant.label}`, () => {
            // 约定：如果你要用 ratio(old/new) summary，bench alias 请用 "new" / "old"

            bench("new", () => {
                // TODO: 替换为新实现
                // 例如：newFn(input, { variant: variant });
                let sum = 0;
                for (let i = 0; i < input.length; i += 1) {
                    sum += input[i];
                }
                return sum;
            });

            bench("old", () => {
                // TODO: 替换为旧实现
                // 例如：oldFn(input, { variant: variant });
                let sum = 0;
                for (let i = 0; i < input.length; i += 1) {
                    sum += input[i];
                }
                return sum;
            });
        });
    }
}

const result = await run({
    colors: true,
    print: (s) => {
        output.teeLine(s);
    }
});

// 输出倍率摘要（可选）
const rows = collectRatioRowsFromMitataResult(result);
rows.sort((a, b) => b.ratio - a.ratio);

if (rows.length > 0) {
    output.teeLine("");
    output.teeLines(formatRatioSummaryTable(rows));
}

output.save();

output.teeLine("");
output.teeLine(`saved: ${output.getResultFilePath()}`);
