/**
 * SyncMenu 命令 - 同步菜单数据到数据库
 * 说明：根据 menu.json 配置文件增量同步菜单数据（最多2级：父级和子级）
 *
 * 流程：
 * 1. 读取 menu.json 配置文件
 * 2. 根据菜单的 path 字段检查是否存在
 * 3. 存在则更新其他字段（name、icon、sort、type、pid）
 * 4. 不存在则新增菜单记录
 * 5. 处理两层菜单结构（父级和子级，不支持多层嵌套）
 * 注：state 字段由框架自动管理（1=正常，2=禁用，0=删除）
 */

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import path from 'node:path';
import { existsSync } from 'node:fs';

interface SyncMenuOptions {
    plan?: boolean;
}

/**
 * 收集配置文件中所有菜单的 path（最多2级）
 */
function collectPaths(menus: any[]): Set<string> {
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
            }
        }
    }

    return paths;
}

/**
 * 同步菜单（两层结构：父级和子级）
 */
async function syncMenus(helper: any, menus: any[]): Promise<{ created: number; updated: number }> {
    const stats = { created: 0, updated: 0 };

    for (const menu of menus) {
        try {
            // 1. 同步父级菜单
            const existingParent = await helper.getOne({
                table: 'addon_admin_menu',
                where: { path: menu.path || '' }
            });

            let parentId: number;

            if (existingParent) {
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
                Logger.info(`  └ 更新父级菜单: ${menu.name} (ID: ${parentId}, Path: ${menu.path})`);
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
                Logger.info(`  └ 新增父级菜单: ${menu.name} (ID: ${parentId}, Path: ${menu.path})`);
            }

            // 2. 同步子级菜单
            if (menu.children && menu.children.length > 0) {
                for (const child of menu.children) {
                    const existingChild = await helper.getOne({
                        table: 'addon_admin_menu',
                        where: { path: child.path || '' }
                    });

                    if (existingChild) {
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
                        Logger.info(`    └ 更新子级菜单: ${child.name} (ID: ${existingChild.id}, PID: ${parentId}, Path: ${child.path})`);
                    } else {
                        const childId = await helper.insData({
                            table: 'addon_admin_menu',
                            data: {
                                pid: parentId,
                                name: child.name,
                                path: child.path || '',
                                icon: child.icon || '',
                                sort: child.sort || 0,
                                type: child.type || 1
                            }
                        });
                        stats.created++;
                        Logger.info(`    └ 新增子级菜单: ${child.name} (ID: ${childId}, PID: ${parentId}, Path: ${child.path})`);
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
 * 删除配置中不存在的菜单
 */
async function deleteObsoleteRecords(helper: any, configPaths: Set<string>): Promise<number> {
    Logger.info(`\n=== 删除配置中不存在的记录 ===`);

    const allRecords = await helper.getAll({
        table: 'addon_admin_menu',
        fields: ['id', 'path', 'name']
    });

    let deletedCount = 0;
    for (const record of allRecords) {
        if (record.path && !configPaths.has(record.path)) {
            await helper.delData({
                table: 'addon_admin_menu',
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
    let dbConnected = false;

    try {
        if (options.plan) {
            Logger.info('[计划] 同步菜单配置到数据库（plan 模式不执行）');
            Logger.info('[计划] 1. 读取 menu.json 配置文件');
            Logger.info('[计划] 2. 根据 path 检查菜单是否存在');
            Logger.info('[计划] 3. 存在则更新，不存在则新增');
            Logger.info('[计划] 4. 处理两层菜单结构（父级和子级）');
            Logger.info('[计划] 5. 显示菜单结构预览');
            return;
        }

        Logger.info('开始同步菜单配置到数据库...\n');

        const projectRoot = process.cwd();

        // 查找 menu.json 文件
        const menuConfigPath = path.join(projectRoot, 'addons', 'admin', 'config', 'menu.json');

        if (!existsSync(menuConfigPath)) {
            Logger.error(`❌ 未找到菜单配置文件: ${menuConfigPath}`);
            Logger.info('提示: 请确保 addons/admin/config/menu.json 文件存在');
            process.exit(1);
        }

        // 读取菜单配置
        const menuFile = Bun.file(menuConfigPath);
        const menuConfig = await menuFile.json();

        // 连接数据库（SQL + Redis）
        await Database.connect();
        dbConnected = true;

        const helper = Database.getDbHelper();

        // 1. 检查表是否存在
        Logger.info('=== 检查数据表 ===');
        const exists = await helper.tableExists('addon_admin_menu');

        if (!exists) {
            Logger.error(`❌ 表 addon_admin_menu 不存在，请先运行 befly syncDb 同步数据库`);
            process.exit(1);
        }

        Logger.info(`✅ 表 addon_admin_menu 存在`);

        // 2. 收集配置文件中所有菜单的 path
        Logger.info('\n=== 步骤 2: 收集配置菜单路径 ===');
        const configPaths = collectPaths(menuConfig);
        Logger.info(`✅ 配置文件中共有 ${configPaths.size} 个菜单路径`);

        // 3. 同步菜单
        Logger.info('\n=== 步骤 3: 同步菜单数据（新增/更新） ===');
        const stats = await syncMenus(helper, menuConfig);

        // 4. 删除文件中不存在的菜单
        const deletedCount = await deleteObsoleteRecords(helper, configPaths);

        // 5. 构建树形结构预览
        Logger.info('\n=== 步骤 5: 菜单结构预览 ===');
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        // 6. 输出统计信息
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
        if (dbConnected) {
            await Database.disconnectSql();
        }
    }
}
