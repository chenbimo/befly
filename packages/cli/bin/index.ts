#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 * 只提供 sync 命令，用于同步所有数据
 *
 * 使用方法：
 *   befly sync              # 使用当前环境（默认 development）
 *
 * 环境变量加载：
 * Bun 自动根据 NODE_ENV 加载对应的 .env 文件：
 * - NODE_ENV=development → .env.development
 * - NODE_ENV=production → .env.production
 * - NODE_ENV=test → .env.test
 */

import { syncCommand } from '../commands/sync.js';
import { Logger } from '../util.js';

/**
 * 主函数
 */
async function main() {
    // 执行 sync 命令
    try {
        await syncCommand();
        Logger.printEnv();
    } catch (error: any) {
        Logger.error('命令执行失败:', error.message || error);
        process.exit(1);
    }
}

// 运行主函数
main();
