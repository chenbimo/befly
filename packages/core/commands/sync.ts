/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncDb → syncApi → syncMenu → syncDev
 */

import { Logger } from '../lib/logger.js';
import { Env } from '../config/env.js';
import { syncDbCommand, type SyncDbStats } from './syncDb.js';
import { syncApiCommand, type SyncApiStats } from './syncApi.js';
import { syncMenuCommand, type SyncMenuStats } from './syncMenu.js';
import { syncDevCommand, type SyncDevStats } from './syncDev.js';
import { existsSync, mkdirSync } from 'node:fs';

interface SyncOptions {}

export async function syncCommand(options: SyncOptions = {}) {
    try {
        const startTime = Date.now();

        // 确保 logs 目录存在
        if (!existsSync('./logs')) {
            mkdirSync('./logs', { recursive: true });
        }

        // 1. 同步数据库表结构
        const dbStats = await syncDbCommand({ dryRun: false });

        // 2. 同步接口（并缓存）
        const apiStats = await syncApiCommand();

        // 3. 同步菜单（并缓存）
        const menuStats = await syncMenuCommand();

        // 4. 同步开发管理员（并缓存角色权限）
        const devStats = await syncDevCommand();

        // 输出总结
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.info(`总耗时: ${totalTime} 秒`);

        console.log(
            Bun.inspect.table([
                { 项目: '处理表数', 数量: dbStats.processedTables },
                { 项目: '创建表', 数量: dbStats.createdTables },
                { 项目: '修改表', 数量: dbStats.modifiedTables },
                { 项目: '新增字段', 数量: dbStats.addFields },
                { 项目: '字段名称变更', 数量: dbStats.nameChanges },
                { 项目: '字段类型变更', 数量: dbStats.typeChanges },
                { 项目: '索引新增', 数量: dbStats.indexCreate },
                { 项目: '索引删除', 数量: dbStats.indexDrop }
            ])
        );

        Logger.info('\n📊 接口同步统计');
        console.log(
            Bun.inspect.table([
                { 项目: '总接口数', 数量: apiStats.totalApis },
                { 项目: '新增接口', 数量: apiStats.created },
                { 项目: '更新接口', 数量: apiStats.updated },
                { 项目: '删除接口', 数量: apiStats.deleted }
            ])
        );

        Logger.info('\n📊 菜单同步统计');
        console.log(
            Bun.inspect.table([
                { 项目: '总菜单数', 数量: menuStats.totalMenus },
                { 项目: '父级菜单', 数量: menuStats.parentMenus },
                { 项目: '子级菜单', 数量: menuStats.childMenus },
                { 项目: '新增菜单', 数量: menuStats.created },
                { 项目: '更新菜单', 数量: menuStats.updated },
                { 项目: '删除菜单', 数量: menuStats.deleted }
            ])
        );

        Logger.info('\n📊 开发账号同步统计');
        console.log(
            Bun.inspect.table([
                { 项目: '管理员数量', 数量: devStats.adminCount },
                { 项目: '角色数量', 数量: devStats.roleCount },
                { 项目: '缓存角色数', 数量: devStats.cachedRoles }
            ])
        );
    } catch (error: any) {
        Logger.error('同步过程中发生错误:', error);
        process.exit(1);
    }
}
