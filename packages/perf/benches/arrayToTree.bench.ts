import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bench, group, run } from "mitata";

import { arrayToTree } from "../../vite/utils/arrayToTree.js";
import { collectRatioRowsFromMitataResult, createBenchTextOutput, formatRatioSummaryTable } from "../utils/benchTextOutput.ts";

type ArrayToTreeOptions = {
    idField?: string;
    pidField?: string;
    childrenField?: string;
    rootPid?: any;
    sortField?: string | null | undefined;
    mapFn?: ((node: any) => any) | undefined;
};

function compareBySortField(sortField: string) {
    return (a: any, b: any) => {
        const av = a ? (a as any)[sortField] : undefined;
        const bv = b ? (b as any)[sortField] : undefined;

        const aMissing = av === undefined || av === null;
        const bMissing = bv === undefined || bv === null;
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;

        if (typeof av === "number" && typeof bv === "number") {
            return av - bv;
        }

        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    };
}

/**
 * 旧版本（对比用）：每一层递归都扫描 items 全量找子节点（O(n^2)）。
 *
 * 注意：这里的 sortField 默认值/禁用语义与当前 arrayToTree 保持一致：
 * - 未传 sortField -> 默认 "sort"
 * - 显式传入 sortField 但为空字符串/undefined/null -> 不排序
 */
function arrayToTreeOld<T>(items: T[], options: ArrayToTreeOptions = {}): T[] {
    const idField = typeof options.idField === "string" ? options.idField : "id";
    const pidField = typeof options.pidField === "string" ? options.pidField : "pid";
    const childrenField = typeof options.childrenField === "string" ? options.childrenField : "children";
    const rootPid = "rootPid" in options ? options.rootPid : 0;
    const sortField = "sortField" in options ? (typeof options.sortField === "string" && options.sortField.length > 0 ? options.sortField : null) : "sort";
    const mapFn = typeof options.mapFn === "function" ? options.mapFn : null;

    const comparator = sortField ? compareBySortField(sortField) : null;

    const build = (pid: any, stack: Set<any>): T[] => {
        const tree: T[] = [];

        for (const item of items) {
            const itemPid = item ? (item as any)[pidField] : undefined;
            if (itemPid !== pid) continue;

            const node = Object.assign({}, item);
            const mappedNode = mapFn ? mapFn(node) : node;
            const nextRootPid = mappedNode ? (mappedNode as any)[idField] : undefined;

            let children: T[] = [];
            if (!stack.has(nextRootPid)) {
                stack.add(nextRootPid);
                children = build(nextRootPid, stack);
                stack.delete(nextRootPid);
            }

            if (children.length > 0) {
                (mappedNode as any)[childrenField] = children;
            }

            tree.push(mappedNode);
        }

        if (comparator) {
            (tree as any[]).sort(comparator);
        }

        return tree;
    };

    return build(rootPid, new Set<any>());
}

function mulberry32(seed: number) {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleInPlace<T>(arr: T[], rand: () => number) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

type MakeItemsOptions = {
    nodeCount: number;
    rootPid: number;
    rootCount: number;
    withSort: boolean;
    missingSortRate: number;
    shuffle: boolean;
    seed: number;
};

function makeItems(options: MakeItemsOptions) {
    const rand = mulberry32(options.seed);

    const items: Array<{ id: number; pid: number; sort?: number | null }> = [];

    const rootCount = Math.min(options.rootCount, options.nodeCount);

    for (let i = 1; i <= rootCount; i += 1) {
        const sort = options.withSort ? i : undefined;
        items.push({ id: i, pid: options.rootPid, sort: sort });
    }

    for (let id = rootCount + 1; id <= options.nodeCount; id += 1) {
        const parentIndex = Math.floor(rand() * (id - 1));
        const parentId = items[parentIndex].id;

        let sort: number | null | undefined = undefined;
        if (options.withSort) {
            const missing = rand() < options.missingSortRate;
            sort = missing ? undefined : Math.floor(rand() * 1000);
        }

        items.push({ id: id, pid: parentId, sort: sort });
    }

    if (options.shuffle) {
        shuffleInPlace(items, rand);
    }

    return items;
}

function makeChainItems(nodeCount: number, rootPid: number, withSort: boolean, seed: number) {
    const rand = mulberry32(seed);
    const items: Array<{ id: number; pid: number; sort?: number }> = [];

    items.push({ id: 1, pid: rootPid, sort: withSort ? 1 : undefined });

    for (let id = 2; id <= nodeCount; id += 1) {
        const sort = withSort ? Math.floor(rand() * 1000) : undefined;
        items.push({ id: id, pid: id - 1, sort: sort });
    }

    return items;
}

function defineBenchCase(label: string, items: any[], options: ArrayToTreeOptions) {
    group(label, () => {
        bench("new", () => {
            arrayToTree(items, options as any);
        });

        bench("old", () => {
            arrayToTreeOld(items, options);
        });
    });
}

function mapFnLikeRealWorld(node: any) {
    // 尽量模拟业务里常见的“轻量映射”：补字段/规范化字段，不引入额外对象层级。
    // 注意：arrayToTree 内部已做了 Object.assign({}, item) 的浅拷贝，这里直接原地写入即可。
    if (!node) return node;

    // 这些字段名只是模拟开销，不依赖真实业务语义。
    node.label = String(node.name ?? node.id);
    node.value = node.id;
    node.disabled = node.state === 0;
    return node;
}

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

const rootPid = 0;

const tree1kAllSortShuffled = makeItems({
    nodeCount: 1_000,
    rootPid: rootPid,
    rootCount: 10,
    withSort: true,
    missingSortRate: 0,
    shuffle: true,
    seed: 1
});

const tree5kAllSortShuffled = makeItems({
    nodeCount: 5_000,
    rootPid: rootPid,
    rootCount: 20,
    withSort: true,
    missingSortRate: 0,
    shuffle: true,
    seed: 2
});

const tree5kMissingSortShuffled = makeItems({
    nodeCount: 5_000,
    rootPid: rootPid,
    rootCount: 20,
    withSort: true,
    missingSortRate: 0.35,
    shuffle: true,
    seed: 3
});

const tree5kNoSortShuffled = makeItems({
    nodeCount: 5_000,
    rootPid: rootPid,
    rootCount: 20,
    withSort: false,
    missingSortRate: 1,
    shuffle: true,
    seed: 4
});

const chain5kAllSort = makeChainItems(5_000, rootPid, true, 5);

defineBenchCase("random tree 1k | default sort=sort", tree1kAllSortShuffled, { rootPid: rootPid });
defineBenchCase("random tree 5k | default sort=sort", tree5kAllSortShuffled, { rootPid: rootPid });
defineBenchCase("random tree 5k | default sort=sort (35% missing)", tree5kMissingSortShuffled, { rootPid: rootPid });
defineBenchCase("random tree 5k | sort disabled", tree5kNoSortShuffled, { rootPid: rootPid, sortField: "" });
defineBenchCase("chain 5k | default sort=sort", chain5kAllSort, { rootPid: rootPid });

defineBenchCase("random tree 5k | default sort=sort | mapFn", tree5kAllSortShuffled, { rootPid: rootPid, mapFn: mapFnLikeRealWorld });
defineBenchCase("random tree 5k | sort disabled | mapFn", tree5kNoSortShuffled, { rootPid: rootPid, sortField: "", mapFn: mapFnLikeRealWorld });

const result = await run({
    colors: true,
    print: (s) => {
        output.teeLine(s);
    }
});

// 额外打印一份 old/new 倍率摘要，便于快速对比（不需要肉眼在整张表里找）。
const rows = collectRatioRowsFromMitataResult(result);
rows.sort((a, b) => b.ratio - a.ratio);

output.teeLine("");
output.teeLines(formatRatioSummaryTable(rows));
output.save();

output.teeLine("");
output.teeLine(`saved: ${output.getResultFilePath()}`);
