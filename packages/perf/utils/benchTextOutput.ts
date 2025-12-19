import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function stripAnsi(text: string) {
    // 常见 ANSI CSI 转义序列（颜色/光标控制等）
    const esc = String.fromCharCode(27);
    return text.replace(new RegExp(`${esc}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}

function safeExecText(command: string) {
    try {
        const result = execSync(command, {
            cwd: process.cwd(),
            stdio: "pipe",
            encoding: "utf8"
        });
        const text = typeof result === "string" ? result.trim() : String(result).trim();
        return text.length > 0 ? text : null;
    } catch {
        return null;
    }
}

export function formatNsPerIter(ns: number) {
    if (!Number.isFinite(ns)) return String(ns);
    if (ns < 1_000) return `${ns.toFixed(2)} ns/iter`;
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)} µs/iter`;
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)} ms/iter`;
    return `${(ns / 1_000_000_000).toFixed(2)} s/iter`;
}

function truncateWithEllipsis(text: string, maxLen: number) {
    if (text.length <= maxLen) return text;
    if (maxLen <= 1) return "…";
    return `${text.slice(0, maxLen - 1)}…`;
}

function padRight(text: string, width: number) {
    if (text.length >= width) return text;
    return text + " ".repeat(width - text.length);
}

export type RatioSummaryRow = {
    name: string;
    newAvgNs: number;
    oldAvgNs: number;
    ratio: number;
};

function clampInt(value: number, min: number, max: number) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function maxLenOf(values: string[]) {
    let max = 0;
    for (const v of values) {
        if (v.length > max) max = v.length;
    }
    return max;
}

export function formatRatioSummaryTable(
    rows: RatioSummaryRow[],
    options?: {
        maxTotalWidth?: number;
        minNameWidth?: number;
        maxNameWidth?: number;
    }
) {
    const maxTotalWidth = typeof options?.maxTotalWidth === "number" ? options?.maxTotalWidth : 104;
    const minNameWidth = typeof options?.minNameWidth === "number" ? options?.minNameWidth : 26;
    const maxNameWidth = typeof options?.maxNameWidth === "number" ? options?.maxNameWidth : 72;

    const newTexts = rows.map((r) => formatNsPerIter(r.newAvgNs));
    const oldTexts = rows.map((r) => formatNsPerIter(r.oldAvgNs));
    const ratioTexts = rows.map((r) => `${r.ratio.toFixed(2)}x`);

    const newWidth = clampInt(Math.max("new".length, maxLenOf(newTexts)), 10, 18);
    const oldWidth = clampInt(Math.max("old".length, maxLenOf(oldTexts)), 10, 18);
    const ratioWidth = clampInt(Math.max("x".length, maxLenOf(ratioTexts)), 5, 10);

    const fixedWidth = 2 + newWidth + 2 + oldWidth + 2 + ratioWidth;
    const computedNameWidth = Math.max("case".length, maxLenOf(rows.map((r) => r.name)));
    const nameWidth = clampInt(Math.min(computedNameWidth, maxTotalWidth - fixedWidth), minNameWidth, maxNameWidth);

    const lines: string[] = [];
    lines.push("ratio(old/new) summary");
    lines.push("---------------------");

    const header = `${padRight("case", nameWidth)}  ${padRight("new", newWidth)}  ${padRight("old", oldWidth)}  ${padRight("x", ratioWidth)}`;
    lines.push(header);
    lines.push("-".repeat(header.length));

    for (const row of rows) {
        const name = padRight(truncateWithEllipsis(row.name, nameWidth), nameWidth);
        const newText = padRight(formatNsPerIter(row.newAvgNs), newWidth);
        const oldText = padRight(formatNsPerIter(row.oldAvgNs), oldWidth);
        const ratioText = padRight(`${row.ratio.toFixed(2)}x`, ratioWidth);
        lines.push(`${name}  ${newText}  ${oldText}  ${ratioText}`);
    }

    return lines;
}

/**
 * 从 mitata 的 run() 返回结果中提取每个 group 的 new/old 平均耗时（ns）并计算倍率。
 *
 * 约定：bench 名称使用 alias "new" / "old"。
 */
export function collectRatioRowsFromMitataResult(
    result: any,
    options?: {
        newAlias?: string;
        oldAlias?: string;
    }
): RatioSummaryRow[] {
    const newAlias = typeof options?.newAlias === "string" && options.newAlias.length > 0 ? options.newAlias : "new";
    const oldAlias = typeof options?.oldAlias === "string" && options.oldAlias.length > 0 ? options.oldAlias : "old";

    type GroupAgg = { name: string; newAvg: number | null; oldAvg: number | null };
    const groupAgg = new Map<number, GroupAgg>();

    const layout = Array.isArray(result?.layout) ? (result.layout as Array<{ name: string | null }>) : undefined;
    const benchmarks = Array.isArray(result?.benchmarks) ? (result.benchmarks as any[]) : [];

    for (const trial of benchmarks) {
        const groupId = typeof trial?.group === "number" ? trial.group : 0;
        const groupName = layout?.[groupId]?.name ?? null;
        const keyName = typeof groupName === "string" && groupName.length > 0 ? groupName : "(no group name)";

        const agg = groupAgg.get(groupId) || { name: keyName, newAvg: null, oldAvg: null };

        const benchName = typeof trial?.alias === "string" ? trial.alias : "";
        const run0 = Array.isArray(trial?.runs) ? trial.runs[0] : null;
        const avg = run0?.stats?.avg;
        if (typeof avg !== "number") {
            groupAgg.set(groupId, agg);
            continue;
        }

        if (benchName === newAlias) {
            agg.newAvg = avg;
        }

        if (benchName === oldAlias) {
            agg.oldAvg = avg;
        }

        groupAgg.set(groupId, agg);
    }

    const rows: RatioSummaryRow[] = [];

    for (const [_groupId, agg] of groupAgg) {
        if (typeof agg.newAvg !== "number" || typeof agg.oldAvg !== "number" || agg.newAvg <= 0) continue;
        rows.push({
            name: agg.name,
            newAvgNs: agg.newAvg,
            oldAvgNs: agg.oldAvg,
            ratio: agg.oldAvg / agg.newAvg
        });
    }

    return rows;
}

export type BenchTextOutputOptions = {
    resultFilePath: string;
    writeToTerminal: boolean;
    includeEnvHeader: boolean;
};

export function createBenchTextOutput(options: BenchTextOutputOptions) {
    let output = "";

    function writeLine(text: string) {
        if (!options.writeToTerminal) return;
        process.stdout.write(`${text}\n`);
    }

    function teeLine(text: string) {
        output += `${stripAnsi(text)}\n`;
        writeLine(text);
    }

    function teeLines(lines: string[]) {
        for (const line of lines) {
            teeLine(line);
        }
    }

    function save() {
        writeFileSync(options.resultFilePath, output, { encoding: "utf8" });
    }

    if (options.includeEnvHeader) {
        const bunVersion = (globalThis as any).Bun?.version ?? (process.versions as any)?.bun ?? null;
        const gitSha = safeExecText("git rev-parse --short HEAD");
        const gitBranch = safeExecText("git rev-parse --abbrev-ref HEAD");
        const gitDirtyText = safeExecText("git status --porcelain");
        const gitDirty = typeof gitDirtyText === "string" ? gitDirtyText.length > 0 : null;

        teeLine(`> generated: ${new Date().toISOString()}`);
        teeLine(`> cwd: ${process.cwd()}`);
        teeLine(`> platform: ${process.platform} ${process.arch}`);
        teeLine(`> bun: ${bunVersion ?? "n/a"}`);
        teeLine(`> node: ${process.version}`);
        teeLine(`> git: ${gitBranch ?? "n/a"}@${gitSha ?? "n/a"}${gitDirty === null ? "" : gitDirty ? " (dirty)" : ""}`);
        teeLine("");
    }

    return {
        teeLine: teeLine,
        teeLines: teeLines,
        save: save,
        getResultFilePath: () => options.resultFilePath
    };
}
