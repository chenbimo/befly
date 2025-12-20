import type { DbHelper } from "../../lib/dbHelper.js";
import type { MenuConfig } from "../../types/sync.js";
import type { SyncDataContext } from "./types.js";
import type { ViewDirMeta } from "befly-shared/utils/scanViewsDir";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock } from "befly-shared/utils/scanViewsDir";
import { join } from "pathe";

import { Logger } from "../../lib/logger.js";
import { projectDir } from "../../paths.js";
import { isDirentDirectory } from "../../utils/isDirentDirectory.js";
import { assertTablesExist } from "./assertTablesExist.js";
import { checkTable } from "./checkTable.js";
import { forEachAddonDir } from "./forEachAddonDir.js";

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

function collectPaths(menus: MenuConfig[]): Set<string> {
    const paths = new Set<string>();

    function collect(items: MenuConfig[]): void {
        for (const menu of items) {
            if (menu.path) {
                paths.add(menu.path);
            }
            if (menu.children && menu.children.length > 0) {
                collect(menu.children);
            }
        }
    }

    collect(menus);
    return paths;
}

async function syncMenuRecursive(dbHelper: DbHelper, menu: MenuConfig, pid: number, existingMenuMap: Map<string, any>): Promise<number> {
    const existing = existingMenuMap.get(menu.path || "");
    let menuId: number;

    if (existing) {
        menuId = existing.id;

        const needUpdate = existing.pid !== pid || existing.name !== menu.name || existing.sort !== (menu.sort ?? 999);

        if (needUpdate) {
            await dbHelper.updData({
                table: "addon_admin_menu",
                where: { id: existing.id },
                data: {
                    pid: pid,
                    name: menu.name,
                    sort: menu.sort ?? 999
                }
            });
        }
    } else {
        menuId = await dbHelper.insData({
            table: "addon_admin_menu",
            data: {
                pid: pid,
                name: menu.name,
                path: menu.path || "",
                sort: menu.sort ?? 999
            }
        });
    }

    if (menu.children && menu.children.length > 0) {
        for (const child of menu.children) {
            await syncMenuRecursive(dbHelper, child, menuId, existingMenuMap);
        }
    }

    return menuId;
}

async function syncMenus(dbHelper: DbHelper, menus: MenuConfig[]): Promise<void> {
    const allExistingMenus = await dbHelper.getAll({
        table: "addon_admin_menu"
    } as any);
    const existingMenuMap = new Map<string, any>();
    for (const menu of allExistingMenus.lists) {
        if (menu.path) {
            existingMenuMap.set(menu.path, menu);
        }
    }

    for (const menu of menus) {
        try {
            await syncMenuRecursive(dbHelper, menu, 0, existingMenuMap);
        } catch (error: any) {
            Logger.error({ err: error, menu: menu.name }, "同步菜单失败");
            throw error;
        }
    }
}

async function deleteObsoleteRecords(dbHelper: DbHelper, configPaths: Set<string>): Promise<void> {
    const allRecords = await dbHelper.getAll({
        table: "addon_admin_menu",
        fields: ["id", "path"],
        where: { state$gte: 0 }
    } as any);

    for (const record of allRecords.lists) {
        if (record.path && !configPaths.has(record.path)) {
            await dbHelper.delForce({
                table: "addon_admin_menu",
                where: { id: record.id }
            });
        }
    }
}

async function loadMenuConfigs(ctx: SyncDataContext): Promise<MenuConfig[]> {
    const allMenus: MenuConfig[] = [];

    await forEachAddonDir({
        addons: ctx.addons,
        pickDir: (addon) => addon.adminViewsDir,
        warnMessage: "扫描 addon views 目录失败",
        onDir: async (addon, adminViewsDir) => {
            const prefix = `/${addon.source}/${addon.name}`;
            const menus = await scanViewsDir(adminViewsDir, prefix);
            if (menus.length > 0) {
                for (const menu of menus) {
                    allMenus.push(menu);
                }
            }
        }
    });

    const menusJsonPath = join(projectDir, "menus.json");
    if (existsSync(menusJsonPath)) {
        try {
            const content = await readFile(menusJsonPath, "utf-8");
            const projectMenus = JSON.parse(content);
            if (Array.isArray(projectMenus) && projectMenus.length > 0) {
                for (const menu of projectMenus) {
                    allMenus.push(menu);
                }
            }
        } catch (error: any) {
            Logger.warn({ err: error }, "读取项目 menus.json 失败");
        }
    }

    return allMenus;
}

export async function syncMenu(ctx: SyncDataContext): Promise<void> {
    const dbHelper = ctx.dbHelper;

    const mergedMenus = await loadMenuConfigs(ctx);

    const tablesOk = await assertTablesExist({
        dbHelper: dbHelper,
        tables: [
            {
                table: "addon_admin_menu",
                skipMessage: "表 addon_admin_menu 不存在，跳过菜单同步"
            }
        ]
    });
    if (!tablesOk) {
        return;
    }

    await checkTable(ctx.addons);

    const configPaths = collectPaths(mergedMenus);

    await syncMenus(dbHelper, mergedMenus);
    await deleteObsoleteRecords(dbHelper, configPaths);

    await ctx.cacheHelper.cacheMenus();
}

// 仅测试用（避免将内部扫描逻辑变成稳定 API）
export const __test__ = {
    scanViewsDir: scanViewsDir
};
