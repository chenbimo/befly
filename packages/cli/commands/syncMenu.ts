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

import { Logger } from './util.js';
import { Database } from 'befly/lib/database.js';
import { RedisHelper } from 'befly/lib/redisHelper.js';
import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { coreDir, projectDir } from 'befly/paths.js';

interface SyncMenuOptions {
    plan?: boolean;
}

interface MenuConfig {
    name: string;
    path: string;
    icon?: string;
    sort?: number;
    type?: number;
    children?: MenuConfig[];
}

export interface SyncMenuStats {
    totalMenus: number;
    parentMenus: number;
    childMenus: number;
    created: number;
    updated: number;
    deleted: number;
}

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
async function syncMenus(helper: any, menus: MenuConfig[]): Promise<{ created: number; updated: number }> {
    const stats = { created: 0, updated: 0 };

    for (const menu of menus) {
        try {
            // 1. 同步父级菜单
            const existingParent = await helper.getOne({
                table: 'core_menu',
                where: { path: menu.path || '' }
            });

            let parentId: number;

            if (existingParent) {
                await helper.updData({
                    table: 'core_menu',
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
            } else {
                parentId = await helper.insData({
                    table: 'core_menu',
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

            // 2. 同步子级菜单（自动追加父级路径前缀）
            if (menu.children && menu.children.length > 0) {
                for (const child of menu.children) {
                    // 子级菜单完整路径 = 父级路径 + 子级路径
                    const childFullPath = menu.path + child.path;

                    const existingChild = await helper.getOne({
                        table: 'core_menu',
                        where: { path: childFullPath }
                    });

                    if (existingChild) {
                        await helper.updData({
                            table: 'core_menu',
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
                    } else {
                        await helper.insData({
                            table: 'core_menu',
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
        table: 'core_menu',
        fields: ['id', 'path', 'name'],
        where: { state$gte: 0 } // 查询所有状态（包括软删除的 state=0）
    });

    let deletedCount = 0;
    for (const record of allRecords) {
        if (record.path && !configPaths.has(record.path)) {
            await helper.delForce({
                table: 'core_menu',
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

        // 1. 读取两个配置文件
        const projectMenuPath = join(projectDir, 'menu.json');
        const coreMenuPath = join(coreDir, 'menu.json');

        const projectMenus = await readMenuConfig(projectMenuPath);
        const coreMenus = await readMenuConfig(coreMenuPath);

        // 2. 合并菜单配置
        const mergedMenus = mergeMenuConfigs(projectMenus, coreMenus);

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 3. 检查表是否存在
        const exists = await helper.tableExists('core_menu');

        if (!exists) {
            Logger.error(`❌ 表 core_menu 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        // 4. 收集配置文件中所有菜单的 path
        const configPaths = collectPaths(mergedMenus);

        // 5. 同步菜单
        const stats = await syncMenus(helper, mergedMenus);

        // 6. 删除文件中不存在的菜单（强制删除）
        const deletedCount = await deleteObsoleteRecords(helper, configPaths);

        // 7. 获取最终菜单数据
        const allMenus = await helper.getAll({
            table: 'core_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        // 8. 缓存菜单数据到 Redis
        try {
            const menus = await helper.getAll({
                table: 'core_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            await RedisHelper.setObject('menus:all', menus);
        } catch (error: any) {
            // 忽略缓存错误
        }

        return {
            totalMenus: allMenus.length,
            parentMenus: allMenus.filter((m: any) => m.pid === 0).length,
            childMenus: allMenus.filter((m: any) => m.pid !== 0).length,
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
