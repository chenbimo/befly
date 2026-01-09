import type { BeflyContext } from "../types/befly";
import type { MenuConfig } from "../types/sync";

import { Logger } from "../lib/logger";
import { getParentPath } from "../utils/loadMenuConfigs";

type MenuDef = {
    path: string;
    name: string;
    sort: number;
    parentPath: string;
};

function createDisableMenuMatcher(ctx: BeflyContext): (path: string) => boolean {
    const rawRules = ctx.config?.disableMenus;
    const rules = Array.isArray(rawRules) ? rawRules : [];
    const patterns: string[] = [];

    for (const rule of rules) {
        if (typeof rule !== "string") {
            continue;
        }
        const trimmed = rule.trim();
        if (!trimmed) {
            continue;
        }
        patterns.push(trimmed);
    }

    if (patterns.length === 0) {
        return () => false;
    }

    const globs = patterns.map((p) => new Bun.Glob(p));

    return (path: string): boolean => {
        if (typeof path !== "string") {
            return false;
        }

        const trimmed = path.trim();
        if (!trimmed) {
            return false;
        }

        // Bun.Glob 在不同场景下可能以 "/a/b" 或 "a/b" 参与匹配；这里双候选兜底。
        const candidates: string[] = [];
        candidates.push(trimmed);
        if (trimmed.startsWith("/")) {
            candidates.push(trimmed.slice(1));
        } else {
            candidates.push(`/${trimmed}`);
        }

        for (const glob of globs) {
            const match = typeof glob === "object" && glob !== null && "match" in glob ? (glob as { match?: unknown }).match : undefined;
            if (typeof match !== "function") {
                throw new Error("syncMenu: 当前 Bun 版本不支持 Bun.Glob.match，无法按 disableMenus 做 glob 匹配");
            }

            const matchFn = match as (candidate: string) => boolean;

            for (const candidate of candidates) {
                if (matchFn.call(glob, candidate)) {
                    return true;
                }
            }
        }
        return false;
    };
}

function filterMenusByDisableMenus(menus: MenuConfig[], isDisabledPath: (path: string) => boolean): MenuConfig[] {
    const out: MenuConfig[] = [];

    for (const menu of menus) {
        if (menu === null || typeof menu !== "object") {
            continue;
        }

        const path = typeof menu.path === "string" ? String(menu.path).trim() : "";
        if (path && isDisabledPath(path)) {
            // 节点被禁用：整棵子树直接忽略
            continue;
        }

        const children = menu.children;
        const nextChildren = Array.isArray(children) && children.length > 0 ? filterMenusByDisableMenus(children, isDisabledPath) : [];

        // 只保留 syncMenu 需要的最小字段，避免引入扩展运算符/不必要的字段复制
        const next: MenuConfig = {};
        if (typeof menu.name === "string") {
            next.name = menu.name;
        }
        if (typeof menu.path === "string") {
            next.path = menu.path;
        }
        if (typeof menu.sort === "number") {
            next.sort = menu.sort;
        }
        if (typeof menu.parentPath === "string") {
            next.parentPath = menu.parentPath;
        }
        if (nextChildren.length > 0) {
            next.children = nextChildren;
        }

        out.push(next as MenuConfig);
    }

    return out;
}

function flattenMenusToDefMap(mergedMenus: MenuConfig[]): Map<string, MenuDef> {
    // 读取配置菜单：扁平化为 path => { name, sort, parentPath }
    // - 以 path 为唯一键：后出现的覆盖先出现的（与旧逻辑“同 path 多次同步同一条记录”一致）
    // parentPath 规则：
    // 1) 若 menu 显式携带 parentPath（包括空字符串），以其为准
    // 2) 否则使用“树结构”推导的父级（由 children 嵌套关系决定；根级为 ""）
    // 3) 保底：若无法推导（极端情况），回退到 getParentPath(path)
    const menuDefMap = new Map<string, MenuDef>();

    const stack: Array<{ menu: MenuConfig; parentPathFromTree: string }> = [];
    for (const m of mergedMenus) {
        stack.push({ menu: m, parentPathFromTree: "" });
    }

    while (stack.length > 0) {
        const item = stack.pop();
        const menu = item ? item.menu : null;
        if (!menu) {
            continue;
        }

        const path = typeof menu.path === "string" ? menu.path : "";

        const rawChildren = menu.children;
        if (rawChildren && Array.isArray(rawChildren) && rawChildren.length > 0) {
            const nextParentPathFromTree = typeof path === "string" ? path : "";
            for (const child of rawChildren) {
                stack.push({ menu: child, parentPathFromTree: nextParentPathFromTree });
            }
        }

        if (!path) {
            continue;
        }

        const name = typeof menu.name === "string" ? menu.name : "";
        if (!name) {
            continue;
        }

        const sort = typeof menu.sort === "number" ? menu.sort : 999999;

        const hasExplicitParentPath = typeof menu.parentPath === "string";
        const parentPath = hasExplicitParentPath ? (menu.parentPath as string) : typeof item?.parentPathFromTree === "string" ? item.parentPathFromTree : getParentPath(path);

        menuDefMap.set(path, {
            path: path,
            name: name,
            sort: sort,
            parentPath: parentPath
        });
    }

    return menuDefMap;
}

export async function syncMenu(ctx: BeflyContext, mergedMenus: MenuConfig[]): Promise<void> {
    if (!ctx.db) {
        throw new Error("syncMenu: ctx.db 未初始化（Db 插件未加载或注入失败）");
    }

    if (!ctx.cache) {
        throw new Error("syncMenu: ctx.cache 未初始化（cache 插件未加载或注入失败）");
    }

    if (!ctx.config) {
        throw new Error("syncMenu: ctx.config 未初始化（config 插件未加载或注入失败）");
    }

    if (!(await ctx.db.tableExists("addon_admin_menu")).data) {
        Logger.debug(`addon_admin_menu 表不存在`);
        return;
    }

    const isDisabledPath = createDisableMenuMatcher(ctx);

    const filteredMenus = filterMenusByDisableMenus(mergedMenus, isDisabledPath);
    const menuDefMap = flattenMenusToDefMap(filteredMenus);

    const configPaths = new Set<string>();
    for (const p of menuDefMap.keys()) {
        configPaths.add(p);
    }

    const tableName = "addon_admin_menu";

    // 2) 批量同步（事务内）：按 path diff 执行批量 insert/update/delete
    await ctx.db.trans(async (trans) => {
        // 读取全部菜单（用于清理 disableMenus 命中菜单：不分 state）
        const allExistingMenusAllState = await trans.getAll<{ id: number; name?: string | null; path?: string | null; parentPath?: string | null; sort?: number | null; state?: number | null }>({
            table: tableName,
            fields: ["id", "name", "path", "parentPath", "sort", "state"]
        });

        const existingListAllState = allExistingMenusAllState.data.lists || [];
        const existingList = existingListAllState.filter((m) => typeof m?.state === "number" && (m.state as number) >= 0);

        const existingMenuMap = new Map<string, any>();
        const duplicateIdSet = new Set<number>();
        const duplicatePathInfoMap = new Map<string, { keptId: number; removedIds: number[] }>();

        for (const record of existingList) {
            if (typeof record?.path !== "string" || !record.path) {
                continue;
            }
            if (typeof record?.id !== "number") {
                continue;
            }

            // disableMenus 命中的记录会在后续强制删除；这里跳过可减少无意义告警
            if (isDisabledPath(record.path)) {
                continue;
            }

            const existing = existingMenuMap.get(record.path);
            if (!existing) {
                existingMenuMap.set(record.path, record);
                continue;
            }

            const existingId = typeof existing?.id === "number" ? existing.id : 0;
            const recordId = record.id;

            // 保留 id 最大的一条（genTimeID 越大通常越新），其余标记为重复并清理
            if (recordId > existingId) {
                existingMenuMap.set(record.path, record);

                if (existingId > 0) {
                    duplicateIdSet.add(existingId);
                }

                const info = duplicatePathInfoMap.get(record.path) || { keptId: recordId, removedIds: [] as number[] };
                info.keptId = recordId;
                if (existingId > 0) {
                    info.removedIds.push(existingId);
                }
                duplicatePathInfoMap.set(record.path, info);
            } else {
                if (recordId > 0) {
                    duplicateIdSet.add(recordId);
                }

                const info = duplicatePathInfoMap.get(record.path) || { keptId: existingId, removedIds: [] as number[] };
                info.keptId = existingId;
                if (recordId > 0) {
                    info.removedIds.push(recordId);
                }
                duplicatePathInfoMap.set(record.path, info);
            }
        }

        if (duplicatePathInfoMap.size > 0) {
            const examples: Array<{ path: string; keptId: number; removedIds: number[] }> = [];
            for (const entry of duplicatePathInfoMap.entries()) {
                const path = entry[0];
                const info = entry[1];
                examples.push({ path: path, keptId: info.keptId, removedIds: info.removedIds });
                if (examples.length >= 10) {
                    break;
                }
            }

            Logger.warn({
                table: tableName,
                duplicatePaths: duplicatePathInfoMap.size,
                duplicateIds: duplicateIdSet.size,
                examples: examples,
                msg: "addon_admin_menu 检测到重复 path 记录：已保留 id 最大的一条并删除其余记录"
            });
        }

        // 2) 一次性算出 insert/update（仅依赖 path diff，不使用 pid，不预生成 id）
        const updList: Array<{ id: number; data: Record<string, any> }> = [];
        const insList: Array<Record<string, any>> = [];

        for (const def of menuDefMap.values()) {
            const existing = existingMenuMap.get(def.path);
            if (existing) {
                const existingParentPath = typeof existing.parentPath === "string" ? existing.parentPath : "";
                const needUpdate = existing.name !== def.name || existing.sort !== def.sort || existingParentPath !== def.parentPath;
                if (needUpdate) {
                    updList.push({
                        id: existing.id,
                        data: {
                            name: def.name,
                            path: def.path,
                            parentPath: def.parentPath,
                            sort: def.sort
                        }
                    });
                }
            } else {
                insList.push({
                    name: def.name,
                    path: def.path,
                    parentPath: def.parentPath,
                    sort: def.sort
                });
            }
        }

        if (updList.length > 0) {
            await trans.updBatch(tableName, updList);
        }

        if (insList.length > 0) {
            await trans.insBatch(tableName, insList);
        }

        // 3) 删除差集（DB - 配置，仅 state>=0） + 删除重复 path 的多余记录 + 删除 disableMenus 命中菜单（不分 state）
        const delIdSet = new Set<number>();

        for (const record of existingList) {
            if (typeof record?.path !== "string" || !record.path) {
                continue;
            }
            if (!configPaths.has(record.path)) {
                if (typeof record?.id === "number") {
                    delIdSet.add(record.id);
                }
            }
        }

        for (const id of duplicateIdSet) {
            if (typeof id === "number" && id > 0) {
                delIdSet.add(id);
            }
        }

        // 删除 disableMenus 命中的菜单：不分 state（包括 state=-1 的历史/禁用数据也一并清理）
        for (const record of existingListAllState) {
            if (typeof record?.path !== "string" || !record.path) {
                continue;
            }
            if (!isDisabledPath(record.path)) {
                continue;
            }
            if (typeof record?.id === "number" && record.id > 0) {
                delIdSet.add(record.id);
            }
        }

        const delIds = Array.from(delIdSet);

        if (delIds.length > 0) {
            await trans.delForceBatch(tableName, delIds);
        }
    });

    // 缓存同步职责已收敛到 syncCache（启动流程单点调用），此处只负责 DB 同步。
}

// 仅测试用（避免将内部扫描逻辑变成稳定 API）
export const __test__ = {
    scanViewsDir: async (viewsDir: string, prefix: string, parentPath: string = "") => {
        const mod = await import("../utils/loadMenuConfigs");
        return await mod.scanViewsDirToMenuConfigs(viewsDir, prefix, parentPath);
    },
    flattenMenusToDefMap: (mergedMenus: MenuConfig[]) => {
        return flattenMenusToDefMap(mergedMenus);
    }
};
