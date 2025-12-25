import type { MenuConfig } from "../types/sync.js";

import { Logger } from "../lib/logger.js";
import { getParentPath } from "../utils/loadMenuConfigs.js";

export async function syncMenu(ctx: any, mergedMenus: MenuConfig[]): Promise<void> {
    if (!(await ctx.db.tableExists("addon_admin_menu"))) {
        Logger.debug(`addon_admin_menu 表不存在`);
        return;
    }

    // 1) 读取配置菜单：扁平化为 path => { name, sort, parentPath }
    // - 以 path 为唯一键：后出现的覆盖先出现的（与旧逻辑“同 path 多次同步同一条记录”一致）
    const menuDefMap = new Map<string, { path: string; name: string; sort: number; parentPath: string }>();
    const stack: MenuConfig[] = [];
    for (const m of mergedMenus) {
        stack.push(m);
    }

    while (stack.length > 0) {
        const menu = stack.pop() as any;
        if (!menu) {
            continue;
        }

        if (menu.children && Array.isArray(menu.children) && menu.children.length > 0) {
            for (const child of menu.children) {
                stack.push(child);
            }
        }

        const path = typeof menu.path === "string" ? menu.path : "";
        if (!path) {
            continue;
        }

        const name = typeof menu.name === "string" ? menu.name : "";
        if (!name) {
            continue;
        }

        const sort = typeof menu.sort === "number" ? menu.sort : 999;
        const parentPath = getParentPath(path);

        menuDefMap.set(path, {
            path: path,
            name: name,
            sort: sort,
            parentPath: parentPath
        });
    }

    const configPaths = new Set<string>();
    for (const p of menuDefMap.keys()) {
        configPaths.add(p);
    }

    const tableName = "addon_admin_menu";

    // 2) 批量同步（事务内）：按 path diff 执行批量 insert/update/delete
    await ctx.db.trans(async (dbHelper: any) => {
        const allExistingMenus = await dbHelper.getAll({
            table: tableName,
            fields: ["id", "name", "path", "parentPath", "sort", "state"],
            where: { state$gte: 0 }
        } as any);

        const existingList = allExistingMenus.lists || [];

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

            Logger.warn(
                {
                    table: tableName,
                    duplicatePaths: duplicatePathInfoMap.size,
                    duplicateIds: duplicateIdSet.size,
                    examples: examples
                },
                "addon_admin_menu 检测到重复 path 记录：已保留 id 最大的一条并删除其余记录"
            );
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
            await dbHelper.updBatch(tableName, updList);
        }

        if (insList.length > 0) {
            await dbHelper.insBatch(tableName, insList);
        }

        // 3) 删除差集（DB - 配置） + 删除重复 path 的多余记录
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

        const delIds = Array.from(delIdSet);

        if (delIds.length > 0) {
            await dbHelper.delForceBatch(tableName, delIds);
        }
    });

    await ctx.cacheHelper.cacheMenus();
}

// 仅测试用（避免将内部扫描逻辑变成稳定 API）
export const __test__ = {
    scanViewsDir: async (viewsDir: string, prefix: string, parentPath: string = "") => {
        const mod = await import("../utils/loadMenuConfigs.js");
        return await mod.scanViewsDirToMenuConfigs(viewsDir, prefix, parentPath);
    }
};
