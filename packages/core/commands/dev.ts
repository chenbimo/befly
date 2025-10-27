/**
 * Dev 命令 - 启动开发服务器
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger } from '../util.js';

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

        // 使用 Bun.spawn 启动开发服务器（不使用 --watch 避免监听 node_modules）
        const args = ['--env-file=.env.development', mainFile];

        const proc = Bun.spawn(['bun', 'run', ...args], {
            cwd: projectRoot,
            stdout: 'inherit',
            stderr: 'inherit',
            stdin: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'development',
                APP_PORT: options.port,
                APP_HOST: options.host,
                LOG_DEBUG: options.verbose ? '1' : process.env.LOG_DEBUG,
                FORCE_COLOR: '1'
            }
        });

        // 添加信号处理，确保优雅关闭
        const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];
        signals.forEach((signal) => {
            process.on(signal, () => {
                Logger.info(`\n收到 ${signal} 信号，正在关闭开发服务器...`);
                proc.kill(signal);
                setTimeout(() => {
                    proc.kill('SIGKILL');
                    process.exit(1);
                }, 5000); // 5 秒强制关闭
            });
        });

        const exitCode = await proc.exited;
        process.exit(exitCode || 0);
    } catch (error) {
        Logger.error('启动开发服务器失败:');
        console.error(error);
        process.exit(1);
    }
}
