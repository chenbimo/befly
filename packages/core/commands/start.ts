/**
 * Start 命令 - 启动生产服务器
 */

import { join } from 'pathe';
import { existsSync } from 'node:fs';
import { Logger } from '../lib/logger.js';
import { ClusterManager } from '../lifecycle/cluster.js';
import { Befly } from '../main.js';

function getProjectRoot(): string {
    let current = process.cwd();
    const path = require('node:path');
    while (current !== path.parse(current).root) {
        if (existsSync(join(current, 'package.json'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return process.cwd();
}

interface StartOptions {
    port: string;
    host: string;
    cluster?: string; // 集群模式：数字或 'max'
}

export async function startCommand(options: StartOptions) {
    try {
        const projectRoot = getProjectRoot();

        // 验证是否在项目目录下
        const packageJsonPath = join(projectRoot, 'package.json');
        if (!existsSync(packageJsonPath)) {
            Logger.error('未找到 package.json 文件，请确保在项目目录下');
            process.exit(1);
        }

        // 设置生产环境变量
        process.env.NODE_ENV = 'production';
        process.env.APP_PORT = options.port;
        process.env.APP_HOST = options.host;

        // 检查是否使用集群模式
        if (options.cluster) {
            // 集群模式
            const instances = options.cluster === 'max' ? 'max' : parseInt(options.cluster);

            const clusterManager = new ClusterManager({
                instances,
                startPort: parseInt(options.port),
                host: options.host,
                projectRoot
            });

            await clusterManager.start();
        } else {
            // 单进程模式
            Logger.info('正在启动生产服务器...\n');
            Logger.info(`端口: ${options.port}`);
            Logger.info(`主机: ${options.host}`);
            Logger.info(`环境: production\n`);

            // 检查环境变量文件
            const envFile = join(projectRoot, '.env.production');
            if (existsSync(envFile)) {
                Logger.info(`环境变量文件: .env.production\n`);
            }

            // 直接启动 Befly 实例
            const app = new Befly();
            await app.listen();
        }
    } catch (error) {
        Logger.error('启动失败:');
        console.error(error);
        process.exit(1);
    }
}
