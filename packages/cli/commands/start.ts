/**
 * Start 命令 - 启动生产服务器
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger } from '../utils/logger.js';

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
}

export async function startCommand(options: StartOptions) {
    try {
        const projectRoot = getProjectRoot();
        const mainFile = join(projectRoot, 'main.ts');

        if (!existsSync(mainFile)) {
            Logger.error('未找到 main.ts 文件');
            process.exit(1);
        }

        // 设置生产环境变量
        process.env.NODE_ENV = 'production';
        process.env.APP_PORT = options.port;
        process.env.APP_HOST = options.host;

        Logger.info('正在启动生产服务器...\n');
        Logger.info(`端口: ${options.port}`);
        Logger.info(`主机: ${options.host}`);
        Logger.info(`环境: production\n`);

        // 直接导入并运行 main.ts（无额外进程开销）
        await import(mainFile);

        // 注意：正常情况下不会执行到这里，因为 main.ts 会启动服务器并持续运行
    } catch (error) {
        Logger.error('启动失败:');
        console.error(error);
        process.exit(1);
    }
}
