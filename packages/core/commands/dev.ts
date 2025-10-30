/**
 * Dev 命令 - 启动开发服务器
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { Befly } from '../main.js';

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

        // 验证是否在 Befly 项目目录下
        const packageJsonPath = join(projectRoot, 'package.json');
        if (!existsSync(packageJsonPath)) {
            Logger.error('未找到 package.json 文件，请确保在项目目录下');
            process.exit(1);
        }

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

        // 直接启动 Befly 实例
        const app = new Befly();
        await app.listen();
    } catch (error) {
        Logger.error('启动开发服务器失败:');
        console.error(error);
        process.exit(1);
    }
}
