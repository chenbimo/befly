#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 * 只提供 sync 命令，用于同步所有数据
 *
 * 使用方法：
 *   befly sync              # 使用当前环境（默认 development）
 *   befly sync -e prod      # 使用生产环境
 *   befly sync -e dev       # 使用开发环境
 *   befly sync --plan       # 计划模式（只显示不执行）
 *   befly sync --help       # 显示帮助
 *
 * 环境变量加载：
 * Bun 自动根据 NODE_ENV 加载对应的 .env 文件：
 * - NODE_ENV=development → .env.development
 * - NODE_ENV=production → .env.production
 * - NODE_ENV=test → .env.test
 */

import { syncCommand } from '../commands/sync.js';
import { Logger } from '../lib/logger.js';
import { join } from 'pathe';
import { getPackageVersion } from '../commands/util.js';

/**
 * 读取版本号
 */
function getVersion(): string {
    const coreDir = join(import.meta.dir, '..');
    return getPackageVersion(coreDir);
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
    const version = getVersion();
    console.log(`
Befly CLI v${version}

用法:
  befly sync [选项]

选项:
  -e, --env <environment>  指定环境 (dev/development, prod/production, test)
  --plan                   计划模式，只显示不执行
  -h, --help               显示帮助信息
  -v, --version            显示版本号

示例:
  befly sync               # 使用当前环境同步所有数据
  befly sync -e prod       # 使用生产环境同步
  befly sync -e dev        # 使用开发环境同步
  befly sync --plan        # 预览同步计划（不执行）
`);
}

/**
 * 显示版本号
 */
function showVersion(): void {
    console.log(getVersion());
}

/**
 * 解析命令行参数
 */
function parseArgs(): { env?: string; plan?: boolean; help?: boolean; version?: boolean } {
    const args = process.argv.slice(2);
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '-v' || arg === '--version') {
            options.version = true;
        } else if (arg === '--plan') {
            options.plan = true;
        } else if (arg === '-e' || arg === '--env') {
            options.env = args[++i];
        } else if (arg === 'sync') {
            // 忽略命令名称
            continue;
        } else {
            Logger.error(`未知参数: ${arg}`);
            Logger.info('使用 befly sync --help 查看帮助信息');
            process.exit(1);
        }
    }

    return options;
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);

    // 如果没有参数，显示帮助
    if (args.length === 0) {
        showHelp();
        process.exit(0);
    }

    const options = parseArgs();

    // 显示帮助
    if (options.help) {
        showHelp();
        process.exit(0);
    }

    // 显示版本
    if (options.version) {
        showVersion();
        process.exit(0);
    }

    // 执行 sync 命令
    try {
        await syncCommand(options);
        Logger.printEnv();
    } catch (error: any) {
        Logger.error('命令执行失败:', error.message || error);
        process.exit(1);
    }
}

// 运行主函数
main();
