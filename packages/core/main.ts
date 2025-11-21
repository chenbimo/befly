/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

import { Logger } from './lib/logger.js';
import { Cipher } from './lib/cipher.js';
import { Jwt } from './lib/jwt.js';
import { Database } from './lib/database.js';
import { loadPlugins } from './loader/loadPlugins.js';
import { loadHooks } from './loader/loadHooks.js';
import { loadApis } from './loader/loadApis.js';
import { rootHandler } from './router/root.js';
import { apiHandler } from './router/api.js';
import { staticHandler } from './router/static.js';
import { coreDir } from './paths.js';
import { DbHelper } from './lib/dbHelper.js';
import { RedisHelper } from './lib/redisHelper.js';
import { checkTable, checkApi, checkApp } from './check.js';
import { Yes, No } from './response.js';
import { calcPerfTime } from 'befly-util';
import { defaultOptions } from './config/defaults.js';
import { syncAllCommand } from './sync/syncAll.js';
import { defu } from 'defu';

import type { Server } from 'bun';
import type { BeflyContext, BeflyOptions } from './types/befly.js';
import type { Plugin } from './types/plugin.js';
import type { Hook } from './types/hook.js';
import type { ApiRoute } from './types/api.js';
/**
 * Befly 框架核心类
 * 职责：管理应用上下文和生命周期
 */
export class Befly {
    /** API 路由映射表 */
    private apiRoutes: Map<string, ApiRoute> = new Map();

    /** 插件列表 */
    private pluginLists: Plugin[] = [];

    /** 钩子列表 */
    private hookLists: Hook[] = [];

    /** 应用上下文 */
    public appContext: BeflyContext;

    /** 最终配置（合并默认值后） */
    public config: BeflyOptions;

    /** 构造函数选项 */
    private options: BeflyOptions;

    constructor(options: BeflyOptions = {}) {
        this.appContext = {};
        this.options = options;
        // 合并配置：用户配置 > 默认配置
        this.config = defu(options, defaultOptions);
    }

    /**
     * 启动完整的生命周期流程
     * @returns HTTP 服务器实例
     */
    private async start(): Promise<Server> {
        const serverStartTime = Bun.nanoseconds();

        // 0. 自动同步 (默认开启)
        if (this.config.autoSync !== 0) {
            try {
                await syncAllCommand();
            } catch (error) {
                Logger.error('自动同步失败，程序退出');
                process.exit(1);
            }
        }

        // 1. 加载所有 API（动态导入必须在最前面，避免 Bun 1.3.2 的崩溃 bug）
        await loadApis(this.apiRoutes);

        // 2. 执行项目结构检查
        const appCheckResult = await checkApp();
        if (!appCheckResult) {
            Logger.error('项目结构检查失败，程序退出');
            process.exit(1);
        }

        // 3. 执行表定义检查
        const tableCheckResult = await checkTable();
        if (!tableCheckResult) {
            Logger.error('表定义检查失败，程序退出');
            process.exit(1);
        }

        // 4. 执行 API 定义检查
        const apiCheckResult = await checkApi();
        if (!apiCheckResult) {
            Logger.error('API 定义检查失败，程序退出');
            process.exit(1);
        }

        // 5. 加载插件
        await loadPlugins({
            pluginLists: this.pluginLists,
            appContext: this.appContext,
            pluginsConfig: this.config.plugins
        });

        // 6. 加载钩子
        await loadHooks({
            hookLists: this.hookLists,
            pluginsConfig: this.config.plugins
        });

        // 7. 启动 HTTP 服务器
        const totalStartupTime = calcPerfTime(serverStartTime);

        return await this.startServer();
    }

    /**
     * 启动 HTTP 服务器
     * @returns HTTP 服务器实例
     */
    private async startServer(): Promise<Server> {
        const startTime = Bun.nanoseconds();
        const port = this.config.appPort || 3000;
        const host = this.config.appHost || '127.0.0.1';
        const appName = this.config.appName || 'Befly App';

        const server = Bun.serve({
            port: port,
            hostname: host,
            routes: {
                '/': rootHandler,
                '/api/*': apiHandler(this.apiRoutes, this.hookLists, this.appContext),
                '/*': staticHandler(this.options.plugins?.cors)
            },
            error: (error: Error) => {
                Logger.error('服务启动时发生错误', error);
                return Response.json({ code: 1, msg: '内部服务器错误' });
            }
        });

        const finalStartupTime = calcPerfTime(startTime);
        Logger.info(`${appName} 启动成功! `);
        Logger.info(`服务器启动耗时: ${finalStartupTime}`);
        Logger.info(`服务器监听地址: http://${host}:${port}`);

        return server;
    }

    /**
     * 启动服务器并注册优雅关闭处理
     */
    async listen(): Promise<Server> {
        const server = await this.start();

        const gracefulShutdown = async (signal: string) => {
            // 1. 停止接收新请求
            server.stop(true);
            Logger.info('HTTP 服务器已停止');

            // 2. 关闭数据库连接
            try {
                await Database.disconnect();
                Logger.info('数据库连接已关闭');
            } catch (error: any) {
                Logger.err('关闭数据库连接时出错:', error);
            }

            Logger.info('服务器已优雅关闭');
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
    Logger,
    Cipher,
    Jwt,
    Yes,
    No,
    Database,
    DbHelper,
    RedisHelper,
    coreDir,
    checkTable,
    checkApi,
    checkApp
};
