#!/usr/bin/env bun
/**
 * 同步菜单数据到数据库
 * 说明：根据 menu.json 配置文件增量同步菜单数据
 *
 * 流程：
 * 1. 读取 menu.json 配置文件
 * 2. 根据菜单的 path 字段检查是否存在
 * 3. 存在则更新其他字段（name、icon、sort、type、pid）
 * 4. 不存在则新增菜单记录
 * 5. 递归处理子菜单，保持层级关系
 * 注：state 字段由框架自动管理（1=正常，2=禁用，0=删除）
 */

import { Env, Logger, initDatabase, closeDatabase } from 'befly';
import { RedisHelper } from 'befly/utils/redisHelper';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import menuConfig from '../config/menu.json';

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
 * 递归同步菜单（增量更新模式）
 * @param helper - DbHelper 实例
 * @param menus - 菜单数组
 * @param parentId - 父菜单 ID（0 表示顶级菜单）
 * @returns 同步的菜单 ID 数组和统计信息
 */
async function syncMenus(helper: any, menus: any[], parentId: number = 0): Promise<{ ids: number[]; stats: { created: number; updated: number } }> {
    const ids: number[] = [];
    const stats = { created: 0, updated: 0 };

    for (const menu of menus) {
        try {
            // 根据 path 查询现有菜单
            const existing = await helper.getOne({
                table: 'addon_admin_menu',
                where: { path: menu.path || '' }
            });

            let menuId: number;

            if (existing) {
                // 存在则更新
                await helper.updData({
                    table: 'addon_admin_menu',
                    where: { id: existing.id },
                    data: {
                        pid: parentId,
                        name: menu.name,
                        icon: menu.icon || '',
                        sort: menu.sort || 0,
                        type: menu.type || 1
                    }
                });
                menuId = existing.id;
                stats.updated++;
                Logger.info(`  ${parentId === 0 ? '└' : '  └'} 更新菜单: ${menu.name} (ID: ${menuId}, PID: ${parentId}, Path: ${menu.path})`);
            } else {
                // 不存在则新增
                menuId = await helper.insData({
                    table: 'addon_admin_menu',
                    data: {
                        pid: parentId,
                        name: menu.name,
                        path: menu.path || '',
                        icon: menu.icon || '',
                        sort: menu.sort || 0,
                        type: menu.type || 1
                    }
                });
                stats.created++;
                Logger.info(`  ${parentId === 0 ? '└' : '  └'} 新增菜单: ${menu.name} (ID: ${menuId}, PID: ${parentId}, Path: ${menu.path})`);
            }

            ids.push(menuId);

            // 如果有子菜单，递归同步
            if (menu.children && menu.children.length > 0) {
                const childResult = await syncMenus(helper, menu.children, menuId);
                ids.push(...childResult.ids);
                stats.created += childResult.stats.created;
                stats.updated += childResult.stats.updated;
            }
        } catch (error: any) {
            Logger.error(`同步菜单 "${menu.name}" 失败:`, error.message || String(error));
            throw error;
        }
    }

    return { ids, stats };
}

/**
 * 构建菜单树形结构预览
 * @param allMenus - 所有菜单数据
 * @param parentId - 父菜单 ID
 * @param level - 缩进层级
 * @returns 树形结构文本行数组
 */
function buildTree(allMenus: any[], parentId: number = 0, level: number = 0): string[] {
    const lines: string[] = [];
    const children = allMenus.filter((m: any) => m.pid === parentId);

    children.forEach((menu: any, index: number) => {
        const isLast = index === children.length - 1;
        const prefix = '  '.repeat(level) + (isLast ? '└─' : '├─');
        const typeLabel = menu.type === 0 ? '[目录]' : '[菜单]';
        lines.push(`${prefix} ${typeLabel} ${menu.name} (${menu.path})`);

        // 递归子菜单
        const subLines = buildTree(allMenus, menu.id, level + 1);
        lines.push(...subLines);
    });

    return lines;
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
            Logger.info('[计划] 4. 递归处理子菜单');
            Logger.info('[计划] 5. 显示菜单结构预览');
            return true;
        }

        Logger.info('开始同步菜单配置到数据库...\n');

        // 初始化数据库连接（Redis + SQL + DbHelper）
        const { helper } = await initDatabase({ max: 1 });
        dbInitialized = true;

        // 1. 检查表是否存在
        Logger.info('=== 步骤 1: 检查数据表 ===');
        const exists = await helper.tableExists('addon_admin_menu');

        if (!exists) {
            Logger.error('❌ 表 addon_admin_menu 不存在，请先运行 befly syncDb 同步数据库');
            return false;
        }

        Logger.info('✅ 表 addon_admin_menu 存在');

        // 2. 递归同步菜单（增量更新）
        Logger.info('\n=== 步骤 2: 同步菜单数据 ===');
        const result = await syncMenus(helper, menuConfig, 0);

        // 3. 构建树形结构预览
        Logger.info('\n=== 步骤 3: 菜单结构预览 ===');
        const allMenus = await helper.getAll({
            table: 'addon_admin_menu',
            fields: ['id', 'pid', 'name', 'path', 'type'],
            orderBy: ['pid#ASC', 'sort#ASC', 'id#ASC']
        });

        const treeLines = buildTree(allMenus);
        Logger.info(treeLines.join('\n'));

        // 4. 输出统计信息
        Logger.info('\n=== 菜单同步完成 ===');
        Logger.info(`✅ 新增菜单: ${result.stats.created} 个`);
        Logger.info(`✅ 更新菜单: ${result.stats.updated} 个`);
        Logger.info(`✅ 总计处理: ${result.ids.length} 个`);
        Logger.info(`📋 当前顶级菜单: ${allMenus.filter((m: any) => m.pid === 0).length} 个`);
        Logger.info(`📋 当前子菜单: ${allMenus.filter((m: any) => m.pid !== 0).length} 个`);

        // 5. 缓存菜单到 Redis
        Logger.info('\n=== 步骤 4: 缓存菜单到 Redis ===');
        try {
            // 查询完整的菜单数据用于缓存（只缓存 state=1 的正常菜单）
            const menusForCache = await helper.getAll({
                table: 'addon_admin_menu',
                fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                orderBy: ['sort#ASC', 'id#ASC']
            });

            // 缓存到 Redis（使用 RedisHelper）
            await RedisHelper.setObject('befly:menus:all', menusForCache);
            Logger.info(`✅ 已缓存 ${menusForCache.length} 个菜单到 Redis (Key: befly:menus:all)`);
        } catch (cacheError: any) {
            Logger.warn('⚠️ 菜单缓存失败（不影响同步）:', cacheError?.message || String(cacheError));
            Logger.error('缓存错误详情:', cacheError);
        }

        return true;
    } catch (error: any) {
        Logger.error('❌ 菜单同步失败:', error);
        if (error.message) {
            Logger.error('错误详情:', error.message);
        }
        if (error.stack) {
            Logger.error('错误堆栈:', error.stack);
        }
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
