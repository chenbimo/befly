/**
 * SyncMenu 命令 - 同步菜单数据到数据库
 * 说明：根据 menu.json 配置文件增量同步菜单数据（最多2级：父级和子级）
 *
 * 流程：
 * 1. 读取 core/config/menu.json 和项目根目录的 menu.json 配置文件
 * 2. core 配置优先覆盖项目配置（根据 path 匹配）
 * 3. 文件不存在或格式错误时默认为空数组
 * 4. 子级菜单自动追加父级路径作为前缀
 * 5. 根据菜单的 path 字段检查是否存在
 * 6. 存在则更新其他字段（name、icon、sort、type、pid）
 * 7. 不存在则新增菜单记录
 * 8. 强制删除配置中不存在的菜单记录
 * 注：state 字段由框架自动管理（1=正常，2=禁用，0=删除）
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Database, RedisHelper, coreDir } from 'befly';
import { Logger, projectDir } from '../util.js';
import { ReportCollector } from '../utils/reportCollector.js';

import type { SyncMenuOptions, MenuConfig, SyncMenuStats, MenuDetail, MenuDetailWithDiff } from '../types.js';

/**
 * 读取菜单配置文件
 * 如果文件不存在或不是数组格式，返回空数组
 */
async function readMenuConfig(filePath: string): Promise<MenuConfig[]> {
    try {
        if (!existsSync(filePath)) {
            return [];
        }

        const file = Bun.file(filePath);
        const content = await file.json();

        // 验证是否为数组
        if (!Array.isArray(content)) {
            return [];
        }

        return content;
    } catch (error: any) {
        return [];
    }
}

/**
 * 合并菜单配置（core 优先覆盖项目）
 * 支持二级菜单结构：父级和子级
 */
function mergeMenuConfigs(projectMenus: MenuConfig[], coreMenus: MenuConfig[]): MenuConfig[] {
    const menuMap = new Map<string, MenuConfig>();

    // 1. 先添加项目菜单
    for (const menu of projectMenus) {
        if (menu.path) {
            menuMap.set(menu.path, { ...menu });
        }
    }

    // 2. core 菜单覆盖同 path 的项目菜单
    for (const menu of coreMenus) {
        if (menu.path) {
            menuMap.set(menu.path, { ...menu });
        }
    }

    // 3. 转换为数组并处理子菜单
    const result: MenuConfig[] = [];
    for (const menu of menuMap.values()) {
        const mergedMenu = { ...menu };

        // 处理子菜单合并
        if (menu.children && menu.children.length > 0) {
            const childMap = new Map<string, MenuConfig>();

            // 先添加项目的子菜单
            const projectMenu = projectMenus.find((m) => m.path === menu.path);
            if (projectMenu?.children) {
                for (const child of projectMenu.children) {
                    if (child.path) {
                        childMap.set(child.path, { ...child });
                    }
                }
            }

            // core 子菜单覆盖
            const coreMenu = coreMenus.find((m) => m.path === menu.path);
            if (coreMenu?.children) {
                for (const child of coreMenu.children) {
                    if (child.path) {
                        childMap.set(child.path, { ...child });
                    }
                }
            }

            mergedMenu.children = Array.from(childMap.values());
        }

        result.push(mergedMenu);
    }

    return result;
}

/**
 * 收集配置文件中所有菜单的 path（最多2级）
 * 子级菜单自动追加父级路径前缀
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
                    // 子级菜单追加父级路径前缀
                    const fullPath = menu.path + child.path;
                    paths.add(fullPath);
                }
            }
        }
    }

    return paths;
}

/**
 * 同步菜单（两层结构：父级和子级）
 * 子级菜单路径自动追加父级路径前缀
 */
async function syncMenus(helper: any, menus: MenuConfig[]): Promise<{ created: number; updated: number; createdList: MenuDetail[]; updatedList: MenuDetailWithDiff[] }> {
    const stats = {
        created: 0,
        updated: 0,
        createdList: [] as MenuDetail[],
        updatedList: [] as MenuDetailWithDiff[]
    };

    for (const menu of menus) {
        try {
            // 1. 同步父级菜单
            const existingParent = await helper.getOne({
                table: 'addon_admin_menu',
                where: { path: menu.path || '' }
            });

            let parentId: number;

            if (existingParent) {
                // 对比差异
                const changes: { field: string; before: any; after: any }[] = [];

                if (existingParent.name !== menu.name) {
                    changes.push({ field: 'name', before: existingParent.name, after: menu.name });
                }
                if (existingParent.icon !== (menu.icon || '')) {
                    changes.push({ field: 'icon', before: existingParent.icon, after: menu.icon || '' });
                }
                if (existingParent.sort !== (menu.sort || 0)) {
                    changes.push({ field: 'sort', before: existingParent.sort, after: menu.sort || 0 });
                }
                if (existingParent.type !== (menu.type || 1)) {
                    changes.push({ field: 'type', before: existingParent.type, after: menu.type || 1 });
                }

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
                parentId = existingParent.id;
                stats.updated++;

                // 记录更新的菜单（只有实际有变化时才记录）
                if (changes.length > 0) {
                    stats.updatedList.push({
                        name: menu.name,
                        path: menu.path || '',
                        icon: menu.icon,
                        sort: menu.sort,
                        type: menu.type,
                        addonName: '',
                        addonTitle: '项目',
                        changes: changes
                    });
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
                stats.createdList.push({
                    name: menu.name,
                    path: menu.path || '',
                    icon: menu.icon,
                    sort: menu.sort,
                    type: menu.type,
                    addonName: '',
                    addonTitle: '项目'
                });
            }

            // 2. 同步子级菜单（自动追加父级路径前缀）
            if (menu.children && menu.children.length > 0) {
                for (const child of menu.children) {
                    // 子级菜单完整路径 = 父级路径 + 子级路径
                    const childFullPath = menu.path + child.path;

                    const existingChild = await helper.getOne({
                        table: 'addon_admin_menu',
                        where: { path: childFullPath }
                    });

                    if (existingChild) {
                        // 对比差异
                        const changes: { field: string; before: any; after: any }[] = [];

                        if (existingChild.name !== child.name) {
                            changes.push({ field: 'name', before: existingChild.name, after: child.name });
                        }
                        if (existingChild.icon !== (child.icon || '')) {
                            changes.push({ field: 'icon', before: existingChild.icon, after: child.icon || '' });
                        }
                        if (existingChild.sort !== (child.sort || 0)) {
                            changes.push({ field: 'sort', before: existingChild.sort, after: child.sort || 0 });
                        }
                        if (existingChild.type !== (child.type || 1)) {
                            changes.push({ field: 'type', before: existingChild.type, after: child.type || 1 });
                        }

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

                        if (changes.length > 0) {
                            stats.updatedList.push({
                                name: child.name,
                                path: childFullPath,
                                icon: child.icon,
                                sort: child.sort,
                                type: child.type,
                                addonName: '',
                                addonTitle: '项目',
                                changes: changes
                            });
                        }
                    } else {
                        await helper.insData({
                            table: 'addon_admin_menu',
                            data: {
                                pid: parentId,
                                name: child.name,
                                path: childFullPath,
                                icon: child.icon || '',
                                sort: child.sort || 0,
                                type: child.type || 1
                            }
                        });
                        stats.created++;
                        stats.createdList.push({
                            name: child.name,
                            path: childFullPath,
                            icon: child.icon,
                            sort: child.sort,
                            type: child.type,
                            addonName: '',
                            addonTitle: '项目'
                        });
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
async function deleteObsoleteRecords(helper: any, configPaths: Set<string>): Promise<{ count: number; list: MenuDetail[] }> {
    const allRecords = await helper.getAll({
        table: 'addon_admin_menu',
        fields: ['id', 'path', 'name', 'icon', 'sort', 'type'],
        where: { state$gte: 0 } // 查询所有状态（包括软删除的 state=0）
    });

    const deletedList: MenuDetail[] = [];
    let deletedCount = 0;

    for (const record of allRecords) {
        if (record.path && !configPaths.has(record.path)) {
            deletedList.push({
                name: record.name || '',
                path: record.path,
                icon: record.icon,
                sort: record.sort,
                type: record.type,
                addonName: '',
                addonTitle: '项目'
            });

            await helper.delForce({
                table: 'addon_admin_menu',
                where: { id: record.id }
            });
            deletedCount++;
        }
    }

    return { count: deletedCount, list: deletedList };
}

/**
 * SyncMenu 命令主函数
 */
export async function syncMenuCommand(options: SyncMenuOptions = {}): Promise<SyncMenuStats> {
    const collector = ReportCollector.getInstance();

    try {
        if (options.plan) {
            Logger.info('[计划] 同步菜单配置到数据库（plan 模式不执行）');
            return { totalMenus: 0, parentMenus: 0, childMenus: 0, created: 0, updated: 0, deleted: 0 };
        }

        // 1. 读取两个配置文件
        collector.startTimer('menu_scanning');
        const projectMenuPath = join(projectDir, 'menu.json');
        const coreMenuPath = join(coreDir, 'menu.json');

        const projectMenus = await readMenuConfig(projectMenuPath);
        const coreMenus = await readMenuConfig(coreMenuPath);

        // 2. 合并菜单配置
        const mergedMenus = mergeMenuConfigs(projectMenus, coreMenus);
        const scanningTime = collector.endTimer('menu_scanning');

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 3. 检查表是否存在
        const exists = await helper.tableExists('addon_admin_menu');

        if (!exists) {
            Logger.error(`表 addon_admin_menu 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        // 4. 收集配置文件中所有菜单的 path
        const configPaths = collectPaths(mergedMenus);

        // 5. 同步菜单
        collector.startTimer('menu_processing');
        const stats = await syncMenus(helper, mergedMenus);

        // 6. 删除文件中不存在的菜单（强制删除）
        const deleteResult = await deleteObsoleteRecords(helper, configPaths);
        const processingTime = collector.endTimer('menu_processing');

        // 7. 获取最终菜单数据
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        // 8. 缓存菜单数据到 Redis
        collector.startTimer('menu_caching');
        try {
            const menus = await helper.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            await RedisHelper.setObject('menus:all', menus);
        } catch (error: any) {
            // 忽略缓存错误
        }
        const cachingTime = collector.endTimer('menu_caching');

        // 9. 收集数据到 ReportCollector
        const parentCount = allMenus.filter((m: any) => m.pid === 0).length;
        const childCount = allMenus.filter((m: any) => m.pid !== 0).length;

        collector.setMenuStats({
            totalMenus: allMenus.length,
            parentMenus: parentCount,
            childMenus: childCount,
            created: stats.created,
            updated: stats.updated,
            deleted: deleteResult.count
        });

        collector.setMenuByAction('created', stats.createdList);
        collector.setMenuByAction('updated', stats.updatedList);
        collector.setMenuByAction('deleted', deleteResult.list);

        collector.setMenuTiming('scanning', scanningTime);
        collector.setMenuTiming('processing', processingTime);
        collector.setMenuTiming('caching', cachingTime);

        return {
            totalMenus: allMenus.length,
            parentMenus: parentCount,
            childMenus: childCount,
            created: stats.created,
            updated: stats.updated,
            deleted: deleteResult.count
        };
    } catch (error: any) {
        Logger.error('菜单同步失败:', error);
        collector.setStatus('error', error.message);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
