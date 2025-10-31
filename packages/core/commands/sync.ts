/**
 * Sync 命令 - 一次性执行所有同步操作
 * 按顺序执行：syncApi → syncMenu → syncDev
 */

import { Logger } from '../lib/logger.js';
import { Env } from '../config/env.js';
import { syncApiCommand } from './syncApi.js';
import { syncMenuCommand } from './syncMenu.js';
import { syncDevCommand } from './syncDev.js';
import { existsSync, mkdirSync } from 'node:fs';

interface SyncOptions {
    env?: string;
    plan?: boolean;
}

export async function syncCommand(options: SyncOptions = {}) {
    try {
        // 如果指定了环境但当前 NODE_ENV 不匹配，重新启动进程
        if (options.env) {
            const envMap: Record<string, string> = {
                dev: 'development',
                development: 'development',
                prod: 'production',
                production: 'production',
                test: 'test'
            };
            
            const targetEnv = envMap[options.env.toLowerCase()] || options.env;
            const currentEnv = process.env.NODE_ENV || 'development';
            
            if (targetEnv !== currentEnv) {
                Logger.info(`切换环境: ${currentEnv} → ${targetEnv}`);
                Logger.info(`重新启动进程以加载正确的环境变量...\n`);
                
                // 重新启动进程，设置正确的 NODE_ENV
                const proc = Bun.spawn(['bun', 'befly', 'sync'], {
                    cwd: process.cwd(),
                    stdout: 'inherit',
                    stderr: 'inherit',
                    stdin: 'inherit',
                    env: {
                        ...process.env,
                        NODE_ENV: targetEnv
                    }
                });
                
                await proc.exited;
                process.exit(proc.exitCode || 0);
            }
        }
        
        Logger.info('========================================');
        Logger.info('开始执行完整同步流程');
        Logger.info(`当前环境: ${process.env.NODE_ENV || 'development'}`);
        Logger.info(`数据库主机: ${Env.DB_HOST}`);
        Logger.info('========================================\n');

        const startTime = Date.now();

        // 确保 logs 目录存在
        if (!existsSync('./logs')) {
            mkdirSync('./logs', { recursive: true });
            Logger.info('✅ 已创建 logs 目录\n');
        }

        // 1. 同步接口（并缓存）
        Logger.info('【步骤 1/3】同步接口数据\n');
        await syncApiCommand(options);
        Logger.info('\n✅ 接口同步完成\n');

        // 2. 同步菜单（并缓存）
        Logger.info('【步骤 2/3】同步菜单数据\n');
        await syncMenuCommand(options);
        Logger.info('\n✅ 菜单同步完成\n');

        // 3. 同步开发管理员（并缓存角色权限）
        Logger.info('【步骤 3/3】同步开发管理员\n');
        await syncDevCommand(options);
        Logger.info('\n✅ 开发管理员同步完成\n');

        // 输出总结
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        Logger.info('========================================');
        Logger.info('🎉 所有同步操作已完成！');
        Logger.info(`总耗时: ${totalTime} 秒`);
        Logger.info('========================================');
    } catch (error: any) {
        Logger.error('同步过程中发生错误:', error);
        process.exit(1);
    }
}
