/**
 * Dev 命令 - 启动开发服务器
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger } from '../utils/logger.js';

interface DevOptions {
    port: string;
    host: string;
    sync: boolean;
    verbose: boolean;
}

function getProjectRoot(): string {
    let current = process.cwd();
    while (current !== require('node:path').parse(current).root) {
        if (existsSync(join(current, 'package.json'))) {
            return current;
        }
        current = require('node:path').dirname(current);
    }
    return process.cwd();
}

export async function devCommand(options: DevOptions) {
    try {
        const projectRoot = getProjectRoot();
        const mainFile = join(projectRoot, 'main.ts');

        if (!existsSync(mainFile)) {
            Logger.error('未找到 main.ts 文件，请确保在 Befly 项目目录下');
            process.exit(1);
        }
        console.log('===================222222');
        // 设置环境变量
        process.env.NODE_ENV = 'development';
        process.env.APP_PORT = options.port;
        process.env.APP_HOST = options.host;

        if (options.verbose) {
            process.env.LOG_DEBUG = '1';
        }

        Logger.info('正在启动开发服务器...\n');
        Logger.info(`端口: ${options.port}`);
        Logger.info(`主机: ${options.host}`);
        Logger.info(`环境: development\n`);

        // 检查环境变量文件
        const envFile = join(projectRoot, '.env.development');
        if (existsSync(envFile)) {
            Logger.info(`环境变量文件: .env.development\n`);
        }

        // 直接导入并运行 main.ts（Bun 会自动加载 .env.development）

        await import(mainFile);

        // 注意：正常情况下不会执行到这里，因为 main.ts 会启动服务器并持续运行
    } catch (error) {
        Logger.error('启动开发服务器失败:');
        console.error(error);
        process.exit(1);
    }
}
