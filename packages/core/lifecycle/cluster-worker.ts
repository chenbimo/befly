/**
 * Cluster Worker 入口
 * 由 ClusterManager 启动的子进程入口文件
 */

import { Befly } from '../main.js';
import { Logger } from '../lib/logger.js';

// 启动 Befly 实例
const app = new Befly();
const server = await app.listen();

// Bun 原生信号处理：当收到 SIGTERM/SIGINT 时优雅关闭
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

signals.forEach((signal) => {
    process.on(signal, async () => {
        const workerId = process.env.CLUSTER_WORKER_ID || 'unknown';
        Logger.info(`Worker ${workerId} 收到 ${signal} 信号，正在关闭...`);

        try {
            // Bun Server 的 stop() 方法：关闭服务器
            // 参数 true 表示强制关闭（不等待现有连接）
            server.stop(true);
            Logger.info(`Worker ${workerId} HTTP 服务器已关闭`);

            // 给予短暂时间让资源清理完成
            await Bun.sleep(100);

            process.exit(0);
        } catch (error) {
            Logger.error(`Worker ${workerId} 关闭失败:`, error);
            process.exit(1);
        }
    });
});

// 处理未捕获的异常，防止进程意外退出
process.on('uncaughtException', (error) => {
    const workerId = process.env.CLUSTER_WORKER_ID || 'unknown';
    Logger.error(`Worker ${workerId} 发生未捕获异常:`, error);
    // 不退出进程，让 ClusterManager 决定是否重启
});

process.on('unhandledRejection', (reason) => {
    const workerId = process.env.CLUSTER_WORKER_ID || 'unknown';
    Logger.error(`Worker ${workerId} 发生未处理的 Promise 拒绝:`, reason);
    // 不退出进程，让 ClusterManager 决定是否重启
});
