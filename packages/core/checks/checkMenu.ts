import type { MenuConfig } from "../types/sync.js";
import type { AddonInfo } from "../utils/scanAddons.js";

import { Logger } from "../lib/logger.js";
import { compileDisableMenuGlobRules, isMenuPathDisabledByGlobRules } from "../utils/disableMenusGlob.js";
import { loadMenuConfigs } from "../utils/loadMenuConfigs.js";

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

type CheckMenuOptions = {
    disableMenus?: string[];
};

type DisableMenuRule = ReturnType<typeof compileDisableMenuGlobRules>[number];

function filterMenusByDisableRules(mergedMenus: MenuConfig[], rules: DisableMenuRule[]): MenuConfig[] {
    if (rules.length === 0) {
        return mergedMenus;
    }

    const filtered: MenuConfig[] = [];

    for (const menu of mergedMenus) {
        const menuPath = typeof (menu as any)?.path === "string" ? String((menu as any).path).trim() : "";
        if (menuPath && isMenuPathDisabledByGlobRules(menuPath, rules)) {
            continue;
        }

        const children = Array.isArray((menu as any)?.children) ? ((menu as any).children as MenuConfig[]) : null;
        if (children && children.length > 0) {
            const nextChildren = filterMenusByDisableRules(children, rules);
            if (nextChildren.length > 0) {
                (menu as any).children = nextChildren;
            } else {
                delete (menu as any).children;
            }
        }

        filtered.push(menu);
    }

    return filtered;
}

export const checkMenu = async (addons: AddonInfo[], options: CheckMenuOptions = {}): Promise<MenuConfig[]> => {
    let hasError = false;

    const mergedMenus = await loadMenuConfigs(addons);

    const disableRules = compileDisableMenuGlobRules(options.disableMenus);
    const filteredMenus = filterMenusByDisableRules(mergedMenus, disableRules);

    if (disableRules.length > 0) {
        Logger.info(
            {
                disableMenus: options.disableMenus,
                before: mergedMenus.length,
                after: filteredMenus.length
            },
            "菜单禁用规则已生效"
        );
    }

    const stack: Array<{ menu: any; depth: number }> = [];
    for (const m of filteredMenus) {
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

    if (hasError) {
        throw new Error("菜单结构检查失败");
    }

    return filteredMenus;
};
