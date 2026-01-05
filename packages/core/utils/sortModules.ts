import { Logger } from "../lib/logger";
import { camelCase } from "./util";

export type SortModulesByDepsOptions<T> = {
    /**
     * 用于日志的模块标签（如："插件"、"钩子"）
     */
    moduleLabel?: string;

    /**
     * 生成模块名（用于 deps 解析与排序 key）。
     * 默认：camelCase(item.fileName)
     */
    getName?: (item: T) => string;

    /**
     * 获取 deps。
     * 默认：item.deps
     */
    getDeps?: (item: T) => string[];
};

/**
 * 按 deps 拓扑排序 scanSources 扫描得到的插件/钩子。
 *
 * 说明：
 * - 输入为 scanSources/scanFiles 的条目数组：每个条目包含 fileName 与 deps。
 * - deps 里的字符串会与 getName(item) 的结果匹配。
 * - 若出现：重复 name、缺失依赖、循环依赖，则返回 false。
 */
export function sortModules<T extends { fileName: string; deps?: any }>(items: T[], options: SortModulesByDepsOptions<T> = {}): T[] | false {
    const moduleLabel = options.moduleLabel || "模块";
    const getName =
        options.getName ||
        ((item: T) => {
            const moduleName = (item as any).moduleName;
            if (typeof moduleName === "string" && moduleName.trim() !== "") {
                return moduleName;
            }
            return camelCase(item.fileName);
        });
    const getDeps = options.getDeps || ((item: T) => (item as any).deps);

    const result: T[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const nameToItem: Record<string, T> = {};
    let isPass = true;

    // 1) 建表 + 重名检查
    for (const item of items) {
        const name = getName(item);

        if (typeof name !== "string" || name.trim() === "") {
            Logger.error({ item: item }, `${moduleLabel} 名称解析失败（getName 返回空字符串）`);
            isPass = false;
            continue;
        }

        if (nameToItem[name]) {
            Logger.error(
                {
                    name: name,
                    first: nameToItem[name],
                    second: item
                },
                `${moduleLabel} 名称重复，无法根据 deps 唯一定位`
            );
            isPass = false;
            continue;
        }

        nameToItem[name] = item;
    }

    if (!isPass) return false;

    // 2) 依赖存在性检查 + deps 类型检查
    for (const item of items) {
        const name = getName(item);
        const deps = getDeps(item);

        if (!Array.isArray(deps)) {
            Logger.error({ module: name, item: item }, `${moduleLabel} 的 deps 必须是数组`);
            isPass = false;
            continue;
        }

        for (const dep of deps) {
            if (typeof dep !== "string") {
                Logger.error({ module: name, dependency: dep, item: item }, `${moduleLabel} 的 deps 必须是字符串数组`);
                isPass = false;
                continue;
            }

            if (!nameToItem[dep]) {
                Logger.error({ module: name, dependency: dep }, `${moduleLabel} 依赖未找到`);
                isPass = false;
            }
        }
    }

    if (!isPass) return false;

    // 3) 拓扑排序（DFS）
    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error({ module: name }, `${moduleLabel} 循环依赖`);
            isPass = false;
            return;
        }

        const item = nameToItem[name];
        if (!item) return;

        const deps = getDeps(item) as string[];

        visiting.add(name);
        for (const dep of deps) {
            visit(dep);
        }
        visiting.delete(name);

        visited.add(name);
        result.push(item);
    };

    for (const item of items) {
        const name = getName(item);
        visit(name);
    }

    return isPass ? result : false;
}
