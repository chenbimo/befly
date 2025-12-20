/**
 * SyncMenu 命令 - 同步菜单数据到数据库
 * 说明：扫描 addon 的 views 目录和项目的 menus.json，同步菜单数据
 *
 * 流程：
 * 1. 扫描所有 addon 的 views 目录下的 index.vue，并从 definePage({ meta }) 解析菜单元信息
 * 2. 根据目录层级构建菜单树（无层级限制）
 * 3. 读取项目的 menus.json 文件（手动配置的菜单）
 * 4. 根据菜单的 path 字段检查是否存在
 * 5. 存在则更新其他字段（name、sort、pid）
 * 6. 不存在则新增菜单记录
 * 7. 强制删除配置中不存在的菜单记录
 * 注：state 字段由框架自动管理（1=正常，2=禁用，0=删除）
 */

import type { SyncMenuOptions, MenuConfig, MenuConfigSource } from "../types/sync.js";
import type { ViewDirMeta } from "befly-shared/utils/scanViewsDir";

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

import { cleanDirName, extractDefinePageMetaFromScriptSetup, extractScriptSetupBlock, normalizeMenuPath, normalizeMenuTree } from "befly-shared/utils/scanViewsDir";
import { join } from "pathe";

import { beflyConfig } from "../befly.config.js";
import { CacheKeys } from "../lib/cacheKeys.js";
import { Connect } from "../lib/connect.js";
import { DbHelper } from "../lib/dbHelper.js";
import { Logger } from "../lib/logger.js";
import { RedisHelper } from "../lib/redisHelper.js";
import { projectDir } from "../paths.js";
import { scanAddons } from "../utils/addonHelper.js";

/**
 * 扫描 views 目录，构建菜单树
 * @param viewsDir views 目录路径
 * @param prefix 路径前缀（addon 前缀）
 * @param parentPath 父级路径
 * @returns 菜单数组
 */
async function scanViewsDir(viewsDir: string, prefix: string, parentPath: string = ""): Promise<MenuConfig[]> {
    if (!existsSync(viewsDir)) {
        return [];
    }

    const menus: MenuConfig[] = [];
    const entries = await readdir(viewsDir, { withFileTypes: true });

    for (const entry of entries) {
        // 只处理目录，忽略 components 目录
        if (!entry.isDirectory() || entry.name === "components") {
            continue;
        }

        const dirPath = join(viewsDir, entry.name);
        const indexVuePath = join(dirPath, "index.vue");

        // 没有 index.vue 的目录不处理
        if (!existsSync(indexVuePath)) {
            continue;
        }

        // 从 index.vue 中解析 definePage({ meta })
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

        // 没有 definePage meta 的目录不处理
        if (!meta?.title) {
            continue;
        }

        // 计算路径：清理数字后缀，index 目录特殊处理
        const cleanName = cleanDirName(entry.name);
        let menuPath: string;
        if (cleanName === "index") {
            // index 目录路径为父级路径；根级别用空字符串（避免 addon prefix 拼出尾随 /）
            menuPath = parentPath;
        } else {
            menuPath = parentPath ? `${parentPath}/${cleanName}` : `/${cleanName}`;
        }

        // 添加 addon 前缀
        const fullPath = prefix ? (menuPath ? `${prefix}${menuPath}` : prefix) : menuPath || "/";

        const menu: MenuConfig = {
            name: meta.title,
            path: fullPath,
            sort: meta.order || 1
        };

        // 递归扫描子目录
        const children = await scanViewsDir(dirPath, prefix, menuPath);
        if (children.length > 0) {
            menu.children = children;
        }

        menus.push(menu);
    }

    // 按 sort 排序
    menus.sort((a, b) => (a.sort || 1) - (b.sort || 1));

    return menus;
}

/**
 * 合并菜单配置
 * 支持无限层级菜单结构
 */
type LoadedMenuConfigs = {
    menus: MenuConfig[];
    source: MenuConfigSource;
    addonName?: string;
};

function mergeMenuConfigs(allMenus: LoadedMenuConfigs[]): MenuConfig[] {
    const menuMap = new Map<string, MenuConfig>();

    for (const { menus } of allMenus) {
        for (const menu of menus) {
            if (!menu.path) continue;

            const existing = menuMap.get(menu.path);
            if (existing) {
                // 合并子菜单
                if (menu.children && menu.children.length > 0) {
                    existing.children = existing.children || [];
                    existing.children.push(...menu.children);
                }
            } else {
                menuMap.set(menu.path, { ...menu });
            }
        }
    }

    return Array.from(menuMap.values());
}

/**
 * 过滤隐藏的菜单（递归处理子菜单）
 */
function filterHiddenMenus(menus: MenuConfig[], hiddenSet: Set<string>): MenuConfig[] {
    const result: MenuConfig[] = [];

    for (const menu of menus) {
        // 如果菜单在隐藏列表中，跳过
        if (menu.path && hiddenSet.has(menu.path)) {
            continue;
        }

        const filtered = { ...menu };

        // 递归过滤子菜单
        if (filtered.children && filtered.children.length > 0) {
            filtered.children = filterHiddenMenus(filtered.children, hiddenSet);
        }

        result.push(filtered);
    }

    return result;
}

/**
 * 收集所有菜单的 path（递归收集所有层级）
 */
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

/**
 * 递归同步单个菜单（无层级限制）
 */
async function syncMenuRecursive(helper: any, menu: MenuConfig, pid: number, existingMenuMap: Map<string, any>): Promise<number> {
    const existing = existingMenuMap.get(menu.path || "");
    let menuId: number;

    if (existing) {
        menuId = existing.id;

        const needUpdate = existing.pid !== pid || existing.name !== menu.name || existing.sort !== (menu.sort || 1);

        if (needUpdate) {
            await helper.updData({
                table: "addon_admin_menu",
                where: { id: existing.id },
                data: {
                    pid: pid,
                    name: menu.name,
                    sort: menu.sort || 1
                }
            });
        }
    } else {
        menuId = await helper.insData({
            table: "addon_admin_menu",
            data: {
                pid: pid,
                name: menu.name,
                path: menu.path || "",
                sort: menu.sort || 1
            }
        });
    }

    if (menu.children && menu.children.length > 0) {
        for (const child of menu.children) {
            await syncMenuRecursive(helper, child, menuId, existingMenuMap);
        }
    }

    return menuId;
}

/**
 * 同步菜单到数据库
 */
async function syncMenus(helper: any, menus: MenuConfig[]): Promise<void> {
    const allExistingMenus = await helper.getAll({
        table: "addon_admin_menu"
    });
    const existingMenuMap = new Map<string, any>();
    for (const menu of allExistingMenus.lists) {
        if (menu.path) {
            existingMenuMap.set(menu.path, menu);
        }
    }

    for (const menu of menus) {
        try {
            await syncMenuRecursive(helper, menu, 0, existingMenuMap);
        } catch (error: any) {
            Logger.error({ err: error, menu: menu.name }, "同步菜单失败");
            throw error;
        }
    }
}

/**
 * 删除配置中不存在的菜单（强制删除）
 */
async function deleteObsoleteRecords(helper: any, configPaths: Set<string>): Promise<void> {
    const allRecords = await helper.getAll({
        table: "addon_admin_menu",
        fields: ["id", "path"],
        where: { state$gte: 0 }
    });

    for (const record of allRecords.lists) {
        if (record.path && !configPaths.has(record.path)) {
            await helper.delForce({
                table: "addon_admin_menu",
                where: { id: record.id }
            });
        }
    }
}

/**
 * 加载所有菜单配置（addon views + 项目 menus.json）
 */
async function loadMenuConfigs(): Promise<LoadedMenuConfigs[]> {
    const allMenus: LoadedMenuConfigs[] = [];

    // 1. 扫描所有 addon 的 views 目录
    const addons = scanAddons();

    for (const addon of addons) {
        try {
            const adminViewsDir = addon.adminViewsDir;
            if (adminViewsDir) {
                const prefix = `/addon/${addon.name}`;
                const menus = await scanViewsDir(adminViewsDir, prefix);
                if (menus.length > 0) {
                    allMenus.push({
                        menus: menus,
                        source: "addon",
                        addonName: addon.name
                    });
                }
            }
        } catch (error: any) {
            Logger.warn({ err: error, addon: addon.name }, "扫描 addon views 目录失败");
        }
    }

    // 2. 读取项目的 menus.json
    const menusJsonPath = join(projectDir, "menus.json");
    if (existsSync(menusJsonPath)) {
        try {
            const content = await readFile(menusJsonPath, "utf-8");
            const projectMenus = JSON.parse(content);
            if (Array.isArray(projectMenus) && projectMenus.length > 0) {
                allMenus.push({
                    menus: projectMenus,
                    source: "app"
                });
            }
        } catch (error: any) {
            Logger.warn({ err: error }, "读取项目 menus.json 失败");
        }
    }

    return allMenus;
}

/**
 * SyncMenu 命令主函数
 */
export async function syncMenuCommand(options: SyncMenuOptions = {}): Promise<void> {
    try {
        if (options.plan) {
            Logger.debug("[计划] 同步菜单配置到数据库（plan 模式不执行）");
            return;
        }

        // 1. 加载所有菜单配置
        const allMenus = await loadMenuConfigs();

        // 2. 合并菜单配置
        let mergedMenus = mergeMenuConfigs(allMenus);

        // 2.1 规范化并去重（防止尾随 / 或多 / 导致隐藏菜单与 DB 同步异常）
        mergedMenus = normalizeMenuTree(mergedMenus);

        // 3. 过滤隐藏菜单（根据 hiddenMenus 配置）
        const hiddenMenus = (beflyConfig as any).hiddenMenus || [];
        if (Array.isArray(hiddenMenus) && hiddenMenus.length > 0) {
            const hiddenSet = new Set(hiddenMenus.map((item: string) => normalizeMenuPath(item)));
            mergedMenus = filterHiddenMenus(mergedMenus, hiddenSet);
            mergedMenus = normalizeMenuTree(mergedMenus);
        }

        // 连接数据库
        await Connect.connect();

        const helper = new DbHelper({ redis: new RedisHelper() } as any, Connect.getSql());

        // 3. 检查表是否存在
        const exists = await helper.tableExists("addon_admin_menu");

        if (!exists) {
            Logger.debug("表 addon_admin_menu 不存在，跳过菜单同步");
            return;
        }

        // 4. 收集所有菜单的 path
        const configPaths = collectPaths(mergedMenus);

        // 5. 同步菜单
        await syncMenus(helper, mergedMenus);

        // 6. 删除不存在的菜单
        await deleteObsoleteRecords(helper, configPaths);

        // 7. 获取最终菜单数据（用于缓存）
        const allMenusData = await helper.getAll({
            table: "addon_admin_menu"
        });

        // 8. 缓存菜单数据到 Redis
        try {
            const redisHelper = new RedisHelper();
            await redisHelper.setObject(CacheKeys.menusAll(), allMenusData.lists);
        } catch (error: any) {
            Logger.warn({ err: error }, "Redis 缓存菜单数据失败");
        }
    } catch (error: any) {
        Logger.error({ err: error }, "菜单同步失败");
        throw error;
    } finally {
        await Connect.disconnect();
    }
}

// 仅测试用（避免将内部扫描逻辑变成稳定 API）
export const __test__ = {
    scanViewsDir: scanViewsDir,
    normalizeMenuPath: normalizeMenuPath
};
