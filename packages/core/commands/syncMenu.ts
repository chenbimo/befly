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

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { coreConfigDir, projectDir } from '../paths.js';

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

/**
 * 读取菜单配置文件
 * 如果文件不存在或不是数组格式，返回空数组
 */
async function readMenuConfig(filePath: string): Promise<MenuConfig[]> {
    try {
        if (!existsSync(filePath)) {
            Logger.warn(`菜单配置文件不存在: ${filePath}，使用空数组`);
            return [];
        }

        const file = Bun.file(filePath);
        const content = await file.json();

        // 验证是否为数组
        if (!Array.isArray(content)) {
            Logger.warn(`菜单配置文件格式错误（非数组）: ${filePath}，使用空数组`);
            return [];
        }

        return content;
    } catch (error: any) {
        Logger.warn(`读取菜单配置失败: ${filePath}，使用空数组`, error.message);
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
                Logger.info(`  └ 更新父级菜单: ${menu.name} (ID: ${parentId}, Path: ${menu.path})`);
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
                Logger.info(`  └ 新增父级菜单: ${menu.name} (ID: ${parentId}, Path: ${menu.path})`);
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
                        Logger.info(`    └ 更新子级菜单: ${child.name} (ID: ${existingChild.id}, PID: ${parentId}, Path: ${childFullPath})`);
                    } else {
                        const childId = await helper.insData({
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
                        Logger.info(`    └ 新增子级菜单: ${child.name} (ID: ${childId}, PID: ${parentId}, Path: ${childFullPath})`);
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
    Logger.info(`\n=== 删除配置中不存在的记录 ===`);

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
            Logger.info(`  └ 删除记录: ${record.name} (ID: ${record.id}, path: ${record.path})`);
        }
    }

    if (deletedCount === 0) {
        Logger.info('  ✅ 无需删除的记录');
    }

    return deletedCount;
}

/**
 * SyncMenu 命令主函数
 */
export async function syncMenuCommand(options: SyncMenuOptions = {}) {
    try {
        if (options.plan) {
            Logger.info('[计划] 同步菜单配置到数据库（plan 模式不执行）');
            Logger.info('[计划] 1. 读取 core/config/menu.json 和项目根目录 menu.json');
            Logger.info('[计划] 2. 合并菜单配置（core 优先覆盖项目）');
            Logger.info('[计划] 3. 子级菜单自动追加父级路径前缀');
            Logger.info('[计划] 4. 根据 path 检查菜单是否存在');
            Logger.info('[计划] 5. 存在则更新，不存在则新增');
            Logger.info('[计划] 6. 强制删除配置中不存在的菜单');
            Logger.info('[计划] 7. 显示菜单结构预览');
            return;
        }

        Logger.info('开始同步菜单配置到数据库...\n');

        // 1. 读取两个配置文件
        Logger.info('=== 步骤 1: 读取菜单配置文件 ===');
        const projectMenuPath = join(projectDir, 'menu.json');
        const coreMenuPath = join(coreConfigDir, 'menu.json');

        Logger.info(`  项目路径: ${projectMenuPath}`);
        Logger.info(`  core 路径: ${coreMenuPath}`);

        const projectMenus = await readMenuConfig(projectMenuPath);
        const coreMenus = await readMenuConfig(coreMenuPath);

        Logger.info(`✅ 项目配置: ${projectMenus.length} 个父级菜单`);
        Logger.info(`✅ core 配置: ${coreMenus.length} 个父级菜单`);

        // 2. 合并菜单配置
        Logger.info('\n=== 步骤 2: 合并菜单配置（core 优先覆盖项目） ===');
        const mergedMenus = mergeMenuConfigs(projectMenus, coreMenus);
        Logger.info(`✅ 合并后共有 ${mergedMenus.length} 个父级菜单`);

        // 打印合并后的菜单结构
        for (const menu of mergedMenus) {
            const childCount = menu.children?.length || 0;
            Logger.info(`  └ ${menu.name} (${menu.path}) - ${childCount} 个子菜单`);
        }

        // 连接数据库（SQL + Redis）
        await Database.connect();

        const helper = Database.getDbHelper();

        // 3. 检查表是否存在
        Logger.info('\n=== 步骤 3: 检查数据表 ===');
        const exists = await helper.tableExists('core_menu');

        if (!exists) {
            Logger.error(`❌ 表 core_menu 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        Logger.info(`✅ 表 core_menu 存在`);

        // 4. 收集配置文件中所有菜单的 path
        Logger.info('\n=== 步骤 4: 收集配置菜单路径 ===');
        const configPaths = collectPaths(mergedMenus);
        Logger.info(`✅ 配置文件中共有 ${configPaths.size} 个菜单路径`);

        // 5. 同步菜单
        Logger.info('\n=== 步骤 5: 同步菜单数据（新增/更新） ===');
        const stats = await syncMenus(helper, mergedMenus);

        // 6. 删除文件中不存在的菜单（强制删除）
        const deletedCount = await deleteObsoleteRecords(helper, configPaths);

        // 7. 构建树形结构预览
        Logger.info('\n=== 步骤 7: 菜单结构预览 ===');
        const allMenus = await helper.getAll({
            table: 'core_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        const parentMenus = allMenus.filter((m: any) => m.pid === 0);
        for (const parent of parentMenus) {
            const children = allMenus.filter((m: any) => m.pid === parent.id);
            Logger.info(`  └ ${parent.name} (${parent.path})`);
            for (const child of children) {
                Logger.info(`    └ ${child.name} (${child.path})`);
            }
        }

        // 8. 输出统计信息
        Logger.info(`\n=== 菜单同步完成 ===`);
        Logger.info(`新增菜单: ${stats.created} 个`);
        Logger.info(`更新菜单: ${stats.updated} 个`);
        Logger.info(`删除菜单: ${deletedCount} 个`);
        Logger.info(`当前父级菜单: ${allMenus.filter((m: any) => m.pid === 0).length} 个`);
        Logger.info(`当前子级菜单: ${allMenus.filter((m: any) => m.pid !== 0).length} 个`);
        Logger.info('提示: 菜单缓存将在服务器启动时自动完成');
    } catch (error: any) {
        Logger.error('菜单同步失败:', error);
        process.exit(1);
    } finally {
        await Database?.disconnect();
    }
}
