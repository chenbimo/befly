/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 lifecycle 层
 */

import { Env } from './env.js';
import { Yes, No } from './util.js';
import { Logger } from './lib/logger.js';
import { Cipher } from './lib/cipher.js';
import { Jwt } from './lib/jwt.js';
import { Database } from './lib/database.js';
import { Lifecycle } from './lifecycle/lifecycle.js';
import { coreDir } from './paths.js';
import { DbHelper } from './lib/dbHelper.js';
import { RedisHelper } from './lib/redisHelper.js';
import { Addon } from './lib/addon.js';

import type { Server } from 'bun';
import type { BeflyContext, BeflyOptions } from './types/befly.js';
/**
 * Befly 框架核心类
 * 职责：管理应用上下文和生命周期
 */
export class Befly {
    /** 生命周期管理器 */
    private lifecycle: Lifecycle;

    /** 应用上下文 */
    public appContext: BeflyContext;

    constructor(options: BeflyOptions = {}) {
        this.lifecycle = new Lifecycle(options);
        this.appContext = {};
    }

    /**
     * 启动服务器并注册优雅关闭处理
     * @param callback - 启动完成后的回调函数
     */
    async listen(callback?: (server: Server) => void): Promise<Server> {
        const server = await this.lifecycle.start(this.appContext, callback);

        // 注册优雅关闭信号处理器
        const gracefulShutdown = async (signal: string) => {
            Logger.info(`\n收到 ${signal} 信号，开始优雅关闭...`);

            // 1. 停止接收新请求
            server.stop(true);
            Logger.info('✅ HTTP 服务器已停止');

            // 2. 关闭数据库连接
            try {
                await Database.disconnect();
                Logger.info('✅ 数据库连接已关闭');
            } catch (error: any) {
                Logger.warn('⚠️ 关闭数据库连接时出错:', error.message);
            }

            Logger.info('✅ 服务器已优雅关闭');
            process.exit(0);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return server;
    }
}

// 核心类和工具导出
export {
    // 配置
    Env,
    Logger,
    Cipher,
    Jwt,
    Yes,
    No,
    coreDir,
    Database,
    DbHelper,
    RedisHelper,
    Addon
};
