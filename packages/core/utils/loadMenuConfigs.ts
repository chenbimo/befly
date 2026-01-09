import type { MenuConfig } from "../types/sync";
import type { AddonInfo } from "./scanAddons";

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";

import { join } from "pathe";

import { Logger } from "../lib/logger";
import { importDefault } from "./importDefault";
import { isDirentDirectory } from "./isDirentDirectory";

type ViewDirMeta = {
    title: string;
    order?: number;
};

export function normalizeViewDirMeta(input: unknown): ViewDirMeta | null {
    if (!input || typeof input !== "object") {
        return null;
    }

    const record = input as Record<string, unknown>;
    const title = record["title"];
    if (typeof title !== "string" || !title) {
        return null;
    }

    const orderRaw = record["order"];
    const order = typeof orderRaw === "number" && Number.isFinite(orderRaw) && Number.isInteger(orderRaw) && orderRaw >= 0 ? orderRaw : undefined;

    if (order === undefined) {
        return {
            title: title
        };
    }

    return {
        title: title,
        order: order
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
        const metaJsonPath = join(dirPath, "meta.json");
        const indexVuePath = join(dirPath, "index.vue");

        let meta: ViewDirMeta | null = null;
        if (!existsSync(metaJsonPath)) {
            continue;
        }

        if (!existsSync(indexVuePath)) {
            Logger.warn({ path: dirPath, msg: "目录存在 meta.json 但缺少 index.vue，已跳过该目录菜单同步" });
            continue;
        }

        const metaRaw = await importDefault<any>(metaJsonPath, {});
        meta = normalizeViewDirMeta(metaRaw);
        if (!meta?.title) {
            Logger.warn({ path: metaJsonPath, msg: "meta.json 缺少有效的 title（以及可选 order:number），已跳过该目录菜单同步" });
            continue;
        }

        if (!meta?.title) {
            continue;
        }

        const cleanName = String(entry.name).replace(/_\d+$/, "");
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
    const parts = path.split("/").filter((p) => Boolean(p));
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
            Logger.warn({
                err: error,
                addon: addon.name,
                addonSource: addon.source,
                dir: adminViewsDir,
                msg: "扫描 addon views 目录失败"
            });
        }
    }

    const menusJsonPath = join(process.cwd(), "menus.json");
    if (existsSync(menusJsonPath)) {
        const appMenus = await importDefault<any>(menusJsonPath, []);
        if (Array.isArray(appMenus) && appMenus.length > 0) {
            for (const menu of appMenus) {
                allMenus.push(menu);
            }
        }
    }

    return allMenus;
}
