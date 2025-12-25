import type { MenuConfig } from "../types/sync.js";
import type { AddonInfo } from "../utils/scanAddons.js";

import { Logger } from "../lib/logger.js";
import { getParentPath, loadMenuConfigs } from "../utils/loadMenuConfigs.js";

function isAddonRootPath(path: string): boolean {
    // addon/app 的根菜单路径：/addon/<name> 或 /app/<name>
    // 它的 parentPath 会是 /addon 或 /app（允许不存在）
    const parts = path.split("/").filter((p) => !!p);
    if (parts.length !== 2) {
        return false;
    }
    return parts[0] === "addon" || parts[0] === "app";
}

function isValidMenuPath(path: string): { ok: boolean; reason: string } {
    if (!path) {
        return { ok: false, reason: "path 不能为空" };
    }
    if (!path.startsWith("/")) {
        return { ok: false, reason: "path 必须以 / 开头" };
    }
    if (path.length > 1 && path.endsWith("/")) {
        return { ok: false, reason: "path 末尾不能是 /（根路径 / 除外）" };
    }
    if (path.includes("//")) {
        return { ok: false, reason: "path 不能包含 //" };
    }
    if (path.includes("..")) {
        return { ok: false, reason: "path 不能包含 .." };
    }
    return { ok: true, reason: "" };
}

export const checkMenu = async (addons: AddonInfo[]): Promise<MenuConfig[]> => {
    let hasError = false;

    const mergedMenus = await loadMenuConfigs(addons);

    const stack: Array<{ menu: any; depth: number }> = [];
    for (const m of mergedMenus) {
        stack.push({ menu: m, depth: 1 });
    }

    const pathSet = new Set<string>();

    while (stack.length > 0) {
        const current = stack.pop() as { menu: any; depth: number };
        const menu = current?.menu;
        const depth = typeof current?.depth === "number" ? current.depth : 0;

        if (menu === null || typeof menu !== "object") {
            hasError = true;
            Logger.warn({ menu: menu }, "菜单节点必须是对象");
            continue;
        }

        if (depth > 3) {
            hasError = true;
            Logger.warn({ path: menu?.path, depth: depth }, "菜单层级超过 3 级（最多三级）");
            continue;
        }

        const children = menu.children;
        if (typeof children !== "undefined" && !Array.isArray(children)) {
            hasError = true;
            Logger.warn({ path: menu?.path, childrenType: typeof children }, "菜单 children 必须是数组");
            continue;
        }

        if (Array.isArray(children) && children.length > 0) {
            if (depth >= 3) {
                hasError = true;
                Logger.warn({ path: menu?.path, depth: depth }, "菜单层级超过 3 级（最多三级）");
            } else {
                for (const child of children) {
                    stack.push({ menu: child, depth: depth + 1 });
                }
            }
        }

        const path = typeof menu.path === "string" ? menu.path.trim() : "";
        const name = typeof menu.name === "string" ? menu.name.trim() : "";
        const sort = typeof menu.sort === "number" ? menu.sort : 999;

        // 标准化输出（用于后续 syncMenu 直接使用）
        if (typeof menu.path === "string") {
            menu.path = path;
        }
        if (typeof menu.name === "string") {
            menu.name = name;
        }
        if (typeof menu.sort === "undefined") {
            menu.sort = sort;
        }

        if (!path) {
            hasError = true;
            Logger.warn({ menu: menu }, "菜单缺少 path（必须是非空字符串）");
            continue;
        }

        const pathCheck = isValidMenuPath(path);
        if (!pathCheck.ok) {
            hasError = true;
            Logger.warn({ path: path, reason: pathCheck.reason }, "菜单 path 不合法");
        }

        if (!name) {
            hasError = true;
            Logger.warn({ path: path, menu: menu }, "菜单缺少 name（必须是非空字符串）");
        }

        if (typeof menu.sort !== "undefined" && typeof menu.sort !== "number") {
            hasError = true;
            Logger.warn({ path: path, sort: menu.sort }, "菜单 sort 必须是 number");
        }

        if (pathSet.has(path)) {
            hasError = true;
            Logger.warn({ path: path }, "菜单 path 重复（严格模式禁止重复 path）");
            continue;
        }

        pathSet.add(path);
    }

    // 父级路径完整性检查
    for (const path of pathSet.values()) {
        const parentPath = getParentPath(path);

        if (!parentPath) {
            continue;
        }

        // /addon/<name> 与 /app/<name>：允许其父级 /addon 或 /app 不存在
        if (isAddonRootPath(path)) {
            continue;
        }

        if (!pathSet.has(parentPath)) {
            hasError = true;
            Logger.warn({ path: path, parentPath: parentPath }, "菜单父级路径不存在（会导致树结构不完整）");
        }

        // 递归检查更上层父级（避免 /a/b/c 只缺 /a/b，或只缺 /a）
        let p = parentPath;
        while (p) {
            const pp = getParentPath(p);
            if (!pp) {
                break;
            }

            // 上层同样允许 /addon 与 /app 缺失
            if (pp === "/addon" || pp === "/app") {
                break;
            }

            if (!pathSet.has(pp)) {
                hasError = true;
                Logger.warn({ path: path, missingParentPath: pp }, "菜单父级链缺失（会导致树结构不完整）");
                break;
            }

            p = pp;
        }
    }

    if (hasError) {
        throw new Error("菜单结构检查失败");
    }

    return mergedMenus;
};
