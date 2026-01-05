import type { MenuConfig } from "../types/sync";
import type { AddonInfo } from "./scanAddons";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import { join } from "pathe";

import { Logger } from "../lib/logger";
import { isDirentDirectory } from "./isDirentDirectory";

type ViewDirMeta = {
    title: string;
    order?: number;
};

/**
 * 清理目录名中的数字后缀
 * 如：login_1 → login, index_2 → index
 */
export function cleanDirName(name: string): string {
    return String(name).replace(/_\d+$/, "");
}

/**
 * 只取第一个 <script ... setup ...> 块
 */
export function extractScriptSetupBlock(vueContent: string): string | null {
    const openTag = /<script\b[^>]*\bsetup\b[^>]*>/i.exec(vueContent);
    if (!openTag) {
        return null;
    }

    const start = openTag.index + openTag[0].length;
    const closeIndex = vueContent.indexOf("</script>", start);
    if (closeIndex < 0) {
        return null;
    }

    return vueContent.slice(start, closeIndex);
}

/**
 * 从 <script setup> 中提取 definePage({ meta })
 *
 * 简化约束：
 * - 每个页面只有一个 definePage
 * - title 是纯字符串字面量
 * - order 是数字字面量（可选）
 * - 不考虑变量/表达式/多段 meta 组合
 */
export function extractDefinePageMetaFromScriptSetup(scriptSetup: string): ViewDirMeta | null {
    const titleMatch = scriptSetup.match(/definePage\s*\([\s\S]*?meta\s*:\s*\{[\s\S]*?title\s*:\s*(["'`])([^"'`]+)\1/);
    if (!titleMatch) {
        return null;
    }

    const orderMatch = scriptSetup.match(/definePage\s*\([\s\S]*?meta\s*:\s*\{[\s\S]*?order\s*:\s*(\d+)/);

    return {
        title: titleMatch[2],
        order: orderMatch ? Number(orderMatch[1]) : undefined
    };
}

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
