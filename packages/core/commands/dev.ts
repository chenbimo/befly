/**
 * Dev 命令 - 启动开发服务器
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { Befly } from '../main.js';
import { getProjectRoot } from './util.js';

interface DevOptions {
    port: string;
    host: string;
    sync: boolean;
    verbose: boolean;
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
        const server = await app.listen();

        // 设置信号处理，确保优雅关闭
        const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
        signals.forEach((signal) => {
            process.on(signal, async () => {
                Logger.info(`\n收到 ${signal} 信号，正在关闭开发服务器...`);
                try {
                    server.stop(true);
                    Logger.info('开发服务器已关闭');
                    process.exit(0);
                } catch (error) {
                    Logger.error('关闭开发服务器失败:', error);
                    process.exit(1);
                }
            });
        });
    } catch (error) {
        Logger.error('启动开发服务器失败:');
        console.error(error);
        process.exit(1);
    }
}
