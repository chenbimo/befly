/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

import { Env } from './env.js';

import { Logger } from './lib/logger.js';
import { Cipher } from './lib/cipher.js';
import { Jwt } from './lib/jwt.js';
import { Database } from './lib/database.js';
import { loadPlugins } from './loader/loadPlugins.js';
import { loadApis } from './loader/loadApis.js';
import { rootHandler } from './router/root.js';
import { apiHandler } from './router/api.js';
import { staticHandler } from './router/static.js';
import { coreDir } from './paths.js';
import { DbHelper } from './lib/dbHelper.js';
import { RedisHelper } from './lib/redisHelper.js';
import { checkTable, checkApi } from './check.js';
import {
    //
    Yes,
    No,
    keysToSnake,
    keysToCamel,
    arrayKeysToCamel,
    pickFields,
    fieldClear,
    calcPerfTime,
    scanAddons,
    getAddonDir,
    addonDirExists
} from './util.js';

import type { Server } from 'bun';
import type { BeflyContext } from './types/befly.js';
import type { Plugin } from './types/plugin.js';
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

    /** 应用上下文 */
    public appContext: BeflyContext;

    constructor() {
        this.appContext = {};
    }

    /**
     * 启动完整的生命周期流程
     * @returns HTTP 服务器实例
     */
    private async start(): Promise<Server> {
        const serverStartTime = Bun.nanoseconds();

        // 2. 执行表定义检查
        const tableCheckResult = await checkTable();
        if (!tableCheckResult) {
            Logger.error('Table 表定义检查失败，程序退出');
            process.exit(1);
        }

        // 3. 执行 API 定义检查
        const apiCheckResult = await checkApi();
        if (!apiCheckResult) {
            Logger.error('API 接口定义检查失败，程序退出');
            process.exit(1);
        }

        // 1. 加载所有 API（动态导入必须在最前面，避免 Bun 1.3.2 的崩溃 bug）
        await loadApis(this.apiRoutes);

        // 3. 加载插件
        await loadPlugins({
            pluginLists: this.pluginLists,
            appContext: this.appContext
        });

        // 4. 启动 HTTP 服务器
        const totalStartupTime = calcPerfTime(serverStartTime);

        return await this.startServer();
    }

    /**
     * 启动 HTTP 服务器
     * @returns HTTP 服务器实例
     */
    private async startServer(): Promise<Server> {
        const startTime = Bun.nanoseconds();

        const server = Bun.serve({
            port: Env.APP_PORT,
            hostname: Env.APP_HOST,
            routes: {
                '/': rootHandler,
                '/api/*': apiHandler(this.apiRoutes, this.pluginLists, this.appContext),
                '/*': staticHandler
            },
            error: (error: Error) => {
                Logger.error('服务启动时发生错误', error);
                return Response.json({ code: 1, msg: '内部服务器错误' });
            }
        });

        const finalStartupTime = calcPerfTime(startTime);
        Logger.info(`${Env.APP_NAME} 服务器启动成功! 服务器启动耗时: ${finalStartupTime}`);
        Logger.info(`服务器监听地址: http://${Env.APP_HOST}:${Env.APP_PORT}`);

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
    Env,
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
    checkApi
};

// 工具函数命名空间导出
export const utils = {
    keysToSnake: keysToSnake,
    keysToCamel: keysToCamel,
    arrayKeysToCamel: arrayKeysToCamel,
    pickFields: pickFields,
    fieldClear: fieldClear,
    calcPerfTime: calcPerfTime,
    scanAddons: scanAddons,
    getAddonDir: getAddonDir,
    addonDirExists: addonDirExists
};
