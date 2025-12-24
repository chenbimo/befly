import type { MenuConfig } from "../types/sync.js";
import type { ViewDirMeta } from "befly-shared/utils/scanViewsDir";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock } from "befly-shared/utils/scanViewsDir";
import { join } from "pathe";

import { Logger } from "../lib/logger.js";
import { isDirentDirectory } from "../utils/isDirentDirectory.js";

async function scanViewsDir(viewsDir: string, prefix: string, parentPath: string = ""): Promise<MenuConfig[]> {
    if (!existsSync(viewsDir)) {
        return [];
    }

    const menus: MenuConfig[] = [];
    const entries = await readdir(viewsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!isDirentDirectory(viewsDir, entry) || entry.name === "components") {
            continue;
        }

        const dirPath = join(viewsDir, entry.name);
        const indexVuePath = join(dirPath, "index.vue");

        if (!existsSync(indexVuePath)) {
            continue;
        }

        let meta: ViewDirMeta | null = null;
        try {
            const content = await readFile(indexVuePath, "utf-8");

            const scriptSetup = extractScriptSetupBlock(content);
            if (!scriptSetup) {
                Logger.warn({ path: indexVuePath }, "index.vue 缺少 <script setup>，已跳过该目录菜单同步");
                continue;
            }

            meta = extractDefinePageMetaFromScriptSetup(scriptSetup);
            if (!meta?.title) {
                Logger.warn({ path: indexVuePath }, "index.vue 未声明 definePage({ meta: { title, order? } })，已跳过该目录菜单同步");
                continue;
            }
        } catch (error: any) {
            Logger.warn({ err: error, path: indexVuePath }, "读取 index.vue 失败");
            continue;
        }

        if (!meta?.title) {
            continue;
        }

        const cleanName = cleanDirName(entry.name);
        let menuPath: string;
        if (cleanName === "index") {
            menuPath = parentPath;
        } else {
            menuPath = parentPath ? `${parentPath}/${cleanName}` : `/${cleanName}`;
        }

        const fullPath = prefix ? (menuPath ? `${prefix}${menuPath}` : prefix) : menuPath || "/";

        const menu: MenuConfig = {
            name: meta.title,
            path: fullPath,
            sort: meta.order ?? 999
        };

        const children = await scanViewsDir(dirPath, prefix, menuPath);
        if (children.length > 0) {
            menu.children = children;
        }

        menus.push(menu);
    }

    menus.sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

    return menus;
}

function getParentPath(path: string): string {
    // "/a/b" => "/a"
    // "/a" => ""
    const parts = path.split("/").filter((p) => !!p);
    if (parts.length <= 1) {
        return "";
    }
    return `/${parts.slice(0, -1).join("/")}`;
}

async function loadMenuConfigs(ctx): Promise<MenuConfig[]> {
    const allMenus: MenuConfig[] = [];

    for (const addon of ctx.addons) {
        const adminViewsDir = addon.adminViewsDir;
        if (!adminViewsDir) {
            continue;
        }

        try {
            const prefix = `/${addon.source}/${addon.name}`;
            const menus = await scanViewsDir(adminViewsDir, prefix);
            if (menus.length > 0) {
                for (const menu of menus) {
                    allMenus.push(menu);
                }
            }
        } catch (error: any) {
            Logger.warn(
                {
                    err: error,
                    addon: addon.name,
                    addonSource: addon.source,
                    dir: adminViewsDir
                },
                "扫描 addon views 目录失败"
            );
        }
    }

    const menusJsonPath = join(process.cwd(), "menus.json");
    if (existsSync(menusJsonPath)) {
        try {
            const content = await readFile(menusJsonPath, "utf-8");
            const appMenus = JSON.parse(content);
            if (Array.isArray(appMenus) && appMenus.length > 0) {
                for (const menu of appMenus) {
                    allMenus.push(menu);
                }
            }
        } catch (error: any) {
            Logger.warn({ err: error }, "读取项目 menus.json 失败");
        }
    }

    return allMenus;
}
export async function syncMenu(ctx): Promise<void> {
    const mergedMenus = await loadMenuConfigs(ctx);

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
    await ctx.dbHelper.trans(async (dbHelper: any) => {
        const allExistingMenus = await dbHelper.getAll({
            table: tableName,
            fields: ["id", "name", "path", "parentPath", "sort", "state"],
            where: { state$gte: 0 }
        } as any);

        const existingList = allExistingMenus.lists || [];

        const existingMenuMap = new Map<string, any>();

        for (const record of existingList) {
            if (typeof record?.path !== "string" || !record.path) {
                continue;
            }

            existingMenuMap.set(record.path, record);
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

        // 3) 删除差集（DB - 配置）
        const delIds: number[] = [];
        for (const record of existingList) {
            if (typeof record?.path !== "string" || !record.path) {
                continue;
            }
            if (!configPaths.has(record.path)) {
                if (typeof record?.id === "number") {
                    delIds.push(record.id);
                }
            }
        }

        if (delIds.length > 0) {
            await dbHelper.delForceBatch(tableName, delIds);
        }
    });

    await ctx.cacheHelper.cacheMenus();
}

// 仅测试用（避免将内部扫描逻辑变成稳定 API）
export const __test__ = {
    scanViewsDir: scanViewsDir
};
