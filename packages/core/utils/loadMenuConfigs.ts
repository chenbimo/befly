import type { MenuConfig } from "../types/sync.js";
import type { AddonInfo } from "./scanAddons.js";
import type { ViewDirMeta } from "befly-shared/utils/scanViewsDir";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock } from "befly-shared/utils/scanViewsDir";
import { join } from "pathe";

import { Logger } from "../lib/logger.js";
import { isDirentDirectory } from "./isDirentDirectory.js";

export async function scanViewsDirToMenuConfigs(viewsDir: string, prefix: string, parentPath: string = ""): Promise<MenuConfig[]> {
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
            sort: meta.order ?? 999999
        };

        const children = await scanViewsDirToMenuConfigs(dirPath, prefix, menuPath);
        if (children.length > 0) {
            menu.children = children;
        }

        menus.push(menu);
    }

    menus.sort((a, b) => (a.sort ?? 999999) - (b.sort ?? 999999));

    return menus;
}

export function getParentPath(path: string): string {
    // "/a/b" => "/a"
    // "/a" => ""
    const parts = path.split("/").filter((p) => !!p);
    if (parts.length <= 1) {
        return "";
    }
    return `/${parts.slice(0, -1).join("/")}`;
}

export async function loadMenuConfigs(addons: AddonInfo[]): Promise<MenuConfig[]> {
    const allMenus: MenuConfig[] = [];

    for (const addon of addons) {
        const adminViewsDirByTopLevel = join(addon.fullPath, "adminViews");
        const adminViewsDirByViews = join(addon.fullPath, "views", "admin");
        const adminViewsDir = existsSync(adminViewsDirByTopLevel) ? adminViewsDirByTopLevel : existsSync(adminViewsDirByViews) ? adminViewsDirByViews : null;
        if (!adminViewsDir) {
            continue;
        }

        try {
            const prefix = `/${addon.source}/${addon.name}`;
            const menus = await scanViewsDirToMenuConfigs(adminViewsDir, prefix);
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
