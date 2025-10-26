#!/usr/bin/env bun
/**
 * 同步菜单数据到数据库
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

import { Env, Logger, initDatabase, closeDatabase } from 'befly';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import menuConfig from '../config/menu.json';
import { collectPaths, checkTableExists, deleteObsoleteRecords, logSyncStats } from '../util';

// CLI 参数类型
interface CliArgs {
    DRY_RUN: boolean;
}

// 解析命令行参数
const CLI: CliArgs = {
    DRY_RUN: process.argv.includes('--plan')
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 同步菜单（两层结构：父级和子级）
 * @param helper - DbHelper 实例
 * @param menus - 菜单数组
 * @returns 同步统计信息
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
                // 存在则更新
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
                // 不存在则新增
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
                        // 存在则更新
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
                        // 不存在则新增
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
 * 同步菜单主函数
 */
async function syncMenu(): Promise<boolean> {
    let dbInitialized = false;

    try {
        if (CLI.DRY_RUN) {
            Logger.info('[计划] 同步菜单配置到数据库（plan 模式不执行）');
            Logger.info('[计划] 1. 读取 menu.json 配置文件');
            Logger.info('[计划] 2. 根据 path 检查菜单是否存在');
            Logger.info('[计划] 3. 存在则更新，不存在则新增');
            Logger.info('[计划] 4. 处理两层菜单结构（父级和子级）');
            Logger.info('[计划] 5. 显示菜单结构预览');
            return true;
        }

        Logger.info('开始同步菜单配置到数据库...\n');

        // 初始化数据库连接（Redis + SQL + DbHelper）
        const { helper } = await initDatabase({ max: 1 });
        dbInitialized = true;

        // 1. 检查表是否存在
        if (!(await checkTableExists(helper, 'addon_admin_menu'))) {
            return false;
        }

        // 2. 收集配置文件中所有菜单的 path
        Logger.info('\n=== 步骤 2: 收集配置菜单路径 ===');
        const configPaths = collectPaths(menuConfig);
        Logger.info(`✅ 配置文件中共有 ${configPaths.size} 个菜单路径`);

        // 3. 同步菜单（新增和更新）
        Logger.info('\n=== 步骤 3: 同步菜单数据（新增/更新） ===');
        const stats = await syncMenus(helper, menuConfig);

        //  4. 删除文件中不存在的菜单
        const deletedCount = await deleteObsoleteRecords(helper, 'addon_admin_menu', configPaths);

        // 5. 构建树形结构预览
        Logger.info('\n=== 步骤 5: 菜单结构预览 ===');
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        // 6. 输出统计信息
        logSyncStats(stats, deletedCount, '菜单');
        Logger.info(`当前父级菜单: ${allMenus.filter((m: any) => m.pid === 0).length} 个`);
        Logger.info(`当前子级菜单: ${allMenus.filter((m: any) => m.pid !== 0).length} 个`);
        Logger.info('提示: 菜单缓存将在服务器启动时自动完成');

        return true;
    } catch (error: any) {
        console.log('🔥[ error ]-262', error);
        Logger.error('菜单同步失败:', { message: error.message, stack: error.stack });
        return false;
    } finally {
        if (dbInitialized) {
            await closeDatabase();
        }
    }
}

// 执行同步
syncMenu()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        Logger.error('执行失败:', error);
        process.exit(1);
    });
