#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 *
 * 使用方法：
 *   befly sync:api          # 同步后端（数据库、API、菜单等）
 *   befly sync:admin        # 同步前端 admin 模板
 *
 * 环境变量加载：
 * Bun 自动根据 NODE_ENV 加载对应的 .env 文件：
 * - NODE_ENV=development → .env.development
 * - NODE_ENV=production → .env.production
 * - NODE_ENV=test → .env.test
 */

import { syncCommand } from '../commands/sync.js';
import { syncAdminCommand } from '../commands/syncAdmin.js';
import { Logger } from '../util.js';

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'sync:api'; // 默认执行 sync:api

    // 打印环境信息
    Logger.printEnv();

    try {
        if (command === 'sync:api') {
            // 同步后端
            await syncCommand();
        } else if (command === 'sync:admin') {
            // 同步前端
            await syncAdminCommand();
        } else {
            Logger.error(`未知命令: ${command}`);
            Logger.info('可用命令:');
            Logger.info('  befly sync:api    - 同步后端（数据库、API、菜单等）');
            Logger.info('  befly sync:admin  - 同步前端 admin 模板');
            process.exit(1);
        }

        // 命令执行成功，主动退出
        process.exit(0);
    } catch (error: any) {
        Logger.error('命令执行失败:', error.message || error);
        process.exit(1);
    }
}

// 运行主函数
main();
