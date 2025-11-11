/**
 * SyncMenu 命令 - 同步菜单数据到数据库
 * 说明：根据 menu.json 配置文件增量同步菜单数据（最多2级：父级和子级）
 *
 * 流程：
 * 1. 扫描项目根目录和所有 addon 的 menu.json 配置文件
 * 2. 项目的 menu.json 优先级最高，可以覆盖 addon 的菜单配置
 * 3. 文件不存在或格式错误时默认为空数组
 * 4. 根据菜单的 path 字段检查是否存在
 * 5. 存在则更新其他字段（name、icon、sort、type、pid）
 * 6. 不存在则新增菜单记录
 * 7. 强制删除配置中不存在的菜单记录
 * 注：state 字段由框架自动管理（1=正常，2=禁用，0=删除）
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Database, RedisHelper, utils } from 'befly';
import { Logger, projectDir } from '../util.js';

import type { SyncMenuOptions, SyncMenuStats, MenuConfig } from '../types.js';

/**
 * 读取菜单配置文件
 * 如果文件不存在或不是数组格式，返回空数组
 */
async function readMenuConfig(filePath: string): Promise<MenuConfig[]> {
    try {
        if (!existsSync(filePath)) {
            return [];
        }

        const content = await import(filePath, { with: { type: 'json' } });

        // 验证是否为数组
        if (!Array.isArray(content.default)) {
            return [];
        }

        return content.default;
    } catch (error: any) {
        return [];
    }
}

/**
 * 为 addon 菜单的 path 添加前缀
 * 规则：
 * 1. 所有路径必须以 / 开头
 * 2. 所有路径都添加 /addon/{addonName} 前缀
 * 3. 递归处理所有层级的子菜单
 * 4. 项目菜单不添加前缀
 */
function addAddonPrefix(menus: MenuConfig[], addonName: string): MenuConfig[] {
    return menus.map((menu) => {
        const newMenu = { ...menu };

        // 处理当前菜单的 path
        if (newMenu.path && newMenu.path.startsWith('/')) {
            newMenu.path = `/addon/${addonName}${newMenu.path}`;
        }

        // 递归处理子菜单
        if (newMenu.children && newMenu.children.length > 0) {
            newMenu.children = addAddonPrefix(newMenu.children, addonName);
        }

        return newMenu;
    });
} /**
 * 合并菜单配置
 * 优先级：项目 menu.json > addon menu.json
 * 支持三级菜单结构：父级、子级、孙级
 */
function mergeMenuConfigs(allMenus: Array<{ menus: MenuConfig[]; addonName: string }>): MenuConfig[] {
    const menuMap = new Map<string, MenuConfig>();

    // 按优先级从低到高合并（后面的覆盖前面的）
    // 1. addon 菜单（优先级低）
    // 2. 项目菜单（优先级最高）
    for (const { menus } of allMenus) {
        for (const menu of menus) {
            if (menu.path) {
                menuMap.set(menu.path, { ...menu });
            }
        }
    }

    // 转换为数组并处理子菜单
    const result: MenuConfig[] = [];
    for (const menu of menuMap.values()) {
        const mergedMenu = { ...menu };

        // 处理第二层子菜单合并
        if (menu.children && menu.children.length > 0) {
            const childMap = new Map<string, MenuConfig>();

            // 按优先级合并子菜单
            for (const { menus } of allMenus) {
                const parentMenu = menus.find((m) => m.path === menu.path);
                if (parentMenu?.children) {
                    for (const child of parentMenu.children) {
                        if (child.path) {
                            childMap.set(child.path, { ...child });
                        }
                    }
                }
            }

            // 处理第三层子菜单合并
            const childrenArray = Array.from(childMap.values());
            for (const child of childrenArray) {
                if (child.children && child.children.length > 0) {
                    const grandChildMap = new Map<string, MenuConfig>();

                    // 按优先级合并第三层菜单
                    for (const { menus } of allMenus) {
                        const parentMenu = menus.find((m) => m.path === menu.path);
                        const childMenu = parentMenu?.children?.find((c) => c.path === child.path);
                        if (childMenu?.children) {
                            for (const grandChild of childMenu.children) {
                                if (grandChild.path) {
                                    grandChildMap.set(grandChild.path, { ...grandChild });
                                }
                            }
                        }
                    }

                    child.children = Array.from(grandChildMap.values());
                }
            }

            mergedMenu.children = childrenArray;
        }

        result.push(mergedMenu);
    }

    return result;
}

/**
 * 收集配置文件中所有菜单的 path（最多3级）
 * 子级菜单使用独立路径
 */
function collectPaths(menus: MenuConfig[]): Set<string> {
    const paths = new Set<string>();

    for (const menu of menus) {
        if (menu.path) {
            paths.add(menu.path);
        }
        if (menu.children && menu.children.length > 0) {
            for (const child of menu.children) {
                if (child.path) {
                    paths.add(child.path);
                }
                // 第三层菜单
                if (child.children && child.children.length > 0) {
                    for (const grandChild of child.children) {
                        if (grandChild.path) {
                            paths.add(grandChild.path);
                        }
                    }
                }
            }
        }
    }

    return paths;
}

/**
 * 同步菜单（三层结构：父级、子级、孙级）
 * 子级菜单使用独立路径
 */
async function syncMenus(helper: any, menus: MenuConfig[]): Promise<{ created: number; updated: number }> {
    const stats = {
        created: 0,
        updated: 0
    };

    for (const menu of menus) {
        try {
            // 1. 同步第一层菜单
            const existingParent = await helper.getOne({
                table: 'addon_admin_menu',
                where: { path: menu.path || '' }
            });

            let parentId: number;

            if (existingParent) {
                parentId = existingParent.id;

                // 检查是否需要更新
                const needUpdate = existingParent.pid !== 0 || existingParent.name !== menu.name || existingParent.icon !== (menu.icon || '') || existingParent.sort !== (menu.sort || 0) || existingParent.type !== (menu.type || 1);

                if (needUpdate) {
                    await helper.updData({
                        table: 'addon_admin_menu',
                        where: { id: existingParent.id },
                        data: {
                            pid: 0,
                            name: menu.name,
                            icon: menu.icon || '',
                            sort: menu.sort || 0,
                            type: menu.type || 1
                        }
                    });
                    stats.updated++;
                }
            } else {
                parentId = await helper.insData({
                    table: 'addon_admin_menu',
                    data: {
                        pid: 0,
                        name: menu.name,
                        path: menu.path || '',
                        icon: menu.icon || '',
                        sort: menu.sort || 0,
                        type: menu.type || 1
                    }
                });
                stats.created++;
            }

            // 2. 同步第二层菜单
            if (menu.children && menu.children.length > 0) {
                for (const child of menu.children) {
                    const childPath = child.path;
                    const existingChild = await helper.getOne({
                        table: 'addon_admin_menu',
                        where: { path: childPath }
                    });

                    let childId: number;

                    if (existingChild) {
                        childId = existingChild.id;

                        // 检查是否需要更新
                        const needUpdate = existingChild.pid !== parentId || existingChild.name !== child.name || existingChild.icon !== (child.icon || '') || existingChild.sort !== (child.sort || 0) || existingChild.type !== (child.type || 1);

                        if (needUpdate) {
                            await helper.updData({
                                table: 'addon_admin_menu',
                                where: { id: existingChild.id },
                                data: {
                                    pid: parentId,
                                    name: child.name,
                                    icon: child.icon || '',
                                    sort: child.sort || 0,
                                    type: child.type || 1
                                }
                            });
                            stats.updated++;
                        }
                    } else {
                        childId = await helper.insData({
                            table: 'addon_admin_menu',
                            data: {
                                pid: parentId,
                                name: child.name,
                                path: childPath,
                                icon: child.icon || '',
                                sort: child.sort || 0,
                                type: child.type || 1
                            }
                        });
                        stats.created++;
                    }

                    // 3. 同步第三层菜单
                    if (child.children && child.children.length > 0) {
                        for (const grandChild of child.children) {
                            const grandChildPath = grandChild.path;
                            const existingGrandChild = await helper.getOne({
                                table: 'addon_admin_menu',
                                where: { path: grandChildPath }
                            });

                            if (existingGrandChild) {
                                // 检查是否需要更新
                                const needUpdate = existingGrandChild.pid !== childId || existingGrandChild.name !== grandChild.name || existingGrandChild.icon !== (grandChild.icon || '') || existingGrandChild.sort !== (grandChild.sort || 0) || existingGrandChild.type !== (grandChild.type || 1);

                                if (needUpdate) {
                                    await helper.updData({
                                        table: 'addon_admin_menu',
                                        where: { id: existingGrandChild.id },
                                        data: {
                                            pid: childId,
                                            name: grandChild.name,
                                            icon: grandChild.icon || '',
                                            sort: grandChild.sort || 0,
                                            type: grandChild.type || 1
                                        }
                                    });
                                    stats.updated++;
                                }
                            } else {
                                await helper.insData({
                                    table: 'addon_admin_menu',
                                    data: {
                                        pid: childId,
                                        name: grandChild.name,
                                        path: grandChildPath,
                                        icon: grandChild.icon || '',
                                        sort: grandChild.sort || 0,
                                        type: grandChild.type || 1
                                    }
                                });
                                stats.created++;
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            Logger.error(`同步菜单 "${menu.name}" 失败:`, error.message || String(error));
            throw error;
        }
    }

    return stats;
}

/**
 * 删除配置中不存在的菜单（强制删除）
 */
async function deleteObsoleteRecords(helper: any, configPaths: Set<string>): Promise<number> {
    const allRecords = await helper.getAll({
        table: 'addon_admin_menu',
        fields: ['id', 'path'],
        where: { state$gte: 0 }
    });

    let deletedCount = 0;

    for (const record of allRecords) {
        if (record.path && !configPaths.has(record.path)) {
            await helper.delForce({
                table: 'addon_admin_menu',
                where: { id: record.id }
            });
            deletedCount++;
        }
    }

    return deletedCount;
}

/**
 * SyncMenu 命令主函数
 */
export async function syncMenuCommand(options: SyncMenuOptions = {}): Promise<SyncMenuStats> {
    try {
        if (options.plan) {
            Logger.info('[计划] 同步菜单配置到数据库（plan 模式不执行）');
            return { totalMenus: 0, parentMenus: 0, childMenus: 0, created: 0, updated: 0, deleted: 0 };
        }

        // 1. 扫描所有 addon 的 menu.json 配置文件
        const allMenus: Array<{ menus: MenuConfig[]; addonName: string }> = [];

        const addonNames = utils.scanAddons();

        for (const addonName of addonNames) {
            const addonMenuPath = utils.getAddonDir(addonName, 'menu.json');
            if (existsSync(addonMenuPath)) {
                const addonMenus = await readMenuConfig(addonMenuPath);
                if (addonMenus.length > 0) {
                    // 为 addon 菜单添加路径前缀
                    const menusWithPrefix = addAddonPrefix(addonMenus, addonName);
                    allMenus.push({ menus: menusWithPrefix, addonName: addonName });
                }
            }
        }

        // 2. 读取项目根目录的 menu.json（优先级最高，不添加前缀）
        const projectMenuPath = join(projectDir, 'menu.json');
        const projectMenus = await readMenuConfig(projectMenuPath);
        if (projectMenus.length > 0) {
            allMenus.push({ menus: projectMenus, addonName: 'project' });
        } // 3. 合并菜单配置（项目配置优先）
        const mergedMenus = mergeMenuConfigs(allMenus);

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 4. 检查表是否存在
        const exists = await helper.tableExists('addon_admin_menu');

        if (!exists) {
            Logger.error(`表 addon_admin_menu 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        // 5. 收集配置文件中所有菜单的 path
        const configPaths = collectPaths(mergedMenus);

        // 6. 同步菜单
        const stats = await syncMenus(helper, mergedMenus);

        // 7. 删除文件中不存在的菜单（强制删除）
        const deletedCount = await deleteObsoleteRecords(helper, configPaths);

        // 8. 获取最终菜单数据
        const allMenusData = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        // 9. 缓存菜单数据到 Redis
        try {
            const menus = await helper.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            const redisHelper = new RedisHelper();
            await redisHelper.setObject('menus:all', menus);
        } catch (error: any) {
            // 忽略缓存错误
        }

        const parentCount = allMenusData.filter((m: any) => m.pid === 0).length;
        const childCount = allMenusData.filter((m: any) => m.pid !== 0).length;

        return {
            totalMenus: allMenusData.length,
            parentMenus: parentCount,
            childMenus: childCount,
            created: stats.created,
            updated: stats.updated,
            deleted: deletedCount
        };
    } catch (error: any) {
        Logger.error('菜单同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
