/**
 * Befly 应用启动入口
 * 环境变量由 Bun 根据 NODE_ENV 自动加载对应的 .env 文件
 * - development: .env.development
 * - production: .env.production
 * - test: .env.test
 */

import { Befly } from '@befly/core';
import { existsSync, mkdirSync } from 'node:fs';

// 确保 logs 目录存在
if (!existsSync('./logs')) {
    mkdirSync('./logs', { recursive: true });
}

const app = new Befly();
const server = await app.listen();

// 优雅关闭处理
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
    process.on(signal, () => {
        console.log(`\n收到 ${signal} 信号，正在关闭服务器...`);
        server.stop(true);
        process.exit(0);
    });
});
