import type { BeflyContext } from "../types/befly";
import type { MenuConfig } from "../types/sync";

import { Logger } from "../lib/logger";
import { compileDisableMenuGlobRules, isMenuPathDisabledByGlobRules } from "../utils/disableMenusGlob";
import { getParentPath } from "../utils/loadMenuConfigs";

type MenuDef = {
    path: string;
    name: string;
    sort: number;
    parentPath: string;
};

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

        const path = typeof (menu as any).path === "string" ? (menu as any).path : "";

        const rawChildren = (menu as any).children;
        if (rawChildren && Array.isArray(rawChildren) && rawChildren.length > 0) {
            const nextParentPathFromTree = typeof path === "string" ? path : "";
            for (const child of rawChildren) {
                stack.push({ menu: child, parentPathFromTree: nextParentPathFromTree });
            }
        }

        if (!path) {
            continue;
        }

        const name = typeof (menu as any).name === "string" ? (menu as any).name : "";
        if (!name) {
            continue;
        }

        const sort = typeof (menu as any).sort === "number" ? (menu as any).sort : 999999;

        const hasExplicitParentPath = typeof (menu as any).parentPath === "string";
        const parentPath = hasExplicitParentPath ? ((menu as any).parentPath as string) : typeof item?.parentPathFromTree === "string" ? item.parentPathFromTree : getParentPath(path);

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

    // 防御性过滤：保证禁用菜单不会进入 DB（即使上游遗漏了 checkMenu 的过滤）
    const disableRules = compileDisableMenuGlobRules(ctx.config?.disableMenus);
    const filteredMergedMenus: MenuConfig[] =
        disableRules.length === 0
            ? mergedMenus
            : (() => {
                  const filterMenusByDisableRules = (menus: MenuConfig[]): MenuConfig[] => {
                      const filtered: MenuConfig[] = [];

                      for (const menu of menus) {
                          const menuPath = typeof (menu as any)?.path === "string" ? String((menu as any).path).trim() : "";
                          if (menuPath && isMenuPathDisabledByGlobRules(menuPath, disableRules)) {
                              continue;
                          }

                          const children = Array.isArray((menu as any)?.children) ? ((menu as any).children as MenuConfig[]) : null;
                          if (children && children.length > 0) {
                              const nextChildren = filterMenusByDisableRules(children);
                              if (nextChildren.length > 0) {
                                  (menu as any).children = nextChildren;
                              } else {
                                  delete (menu as any).children;
                              }
                          }

                          filtered.push(menu);
                      }

                      return filtered;
                  };

                  return filterMenusByDisableRules(mergedMenus);
              })();

    const menuDefMap = flattenMenusToDefMap(filteredMergedMenus);

    const configPaths = new Set<string>();
    for (const p of menuDefMap.keys()) {
        configPaths.add(p);
    }

    const tableName = "addon_admin_menu";

    // 2) 批量同步（事务内）：按 path diff 执行批量 insert/update/delete
    await ctx.db.trans(async (trans: any) => {
        // 读取全部菜单（用于清理禁用菜单：不分 state）
        const allExistingMenusAllState = await trans.getAll({
            table: tableName,
            fields: ["id", "name", "path", "parentPath", "sort", "state"]
        } as any);

        const existingListAllState = allExistingMenusAllState.data.lists || [];
        const existingList = existingListAllState.filter((m: any) => typeof m?.state === "number" && m.state >= 0);

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

        // 3) 删除差集（DB - 配置，仅 state>=0） + 删除重复 path 的多余记录 + 删除禁用菜单（不分 state）
        const delIdSet = new Set<number>();

        // 3.1) 清理禁用菜单：只要命中 disableMenus，就强制删除（避免 menu/list 之类接口还能查到）
        if (disableRules.length > 0) {
            for (const record of existingListAllState) {
                const recordPath = typeof record?.path === "string" ? String(record.path).trim() : "";
                if (!recordPath) {
                    continue;
                }

                if (isMenuPathDisabledByGlobRules(recordPath, disableRules)) {
                    if (typeof record?.id === "number" && record.id > 0) {
                        delIdSet.add(record.id);
                    }
                }
            }
        }

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
