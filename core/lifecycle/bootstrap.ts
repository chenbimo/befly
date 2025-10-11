/**
 * 服务启动引导器
 * 负责组装和启动Bun HTTP服务器
 */

import type { Server } from 'bun';
import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { Env } from '../config/env.js';
import { rootHandler } from '../router/root.js';
import { apiHandler } from '../router/api.js';
import { staticHandler } from '../router/static.js';
import { errorHandler } from '../router/error.js';
import type { BeflyContext } from '../types/befly.js';
import type { ApiRoute } from '../types/api.js';
import type { Plugin } from '../types/plugin.js';

/**
 * 引导器类
 */
export class Bootstrap {
    /**
     * 启动HTTP服务器
     * @param befly - Befly实例（需要访问 apiRoutes, pluginLists, appContext, appOptions）
     * @param callback - 启动后的回调函数
     */
    static async start(
        befly: {
            apiRoutes: Map<string, ApiRoute>;
            pluginLists: Plugin[];
            appContext: BeflyContext;
            appOptions: any;
        },
        callback?: (server: Server) => void
    ): Promise<Server> {
        const startTime = Bun.nanoseconds();

        const server = Bun.serve({
            port: Env.APP_PORT,
            hostname: Env.APP_HOST,
            routes: {
                '/': rootHandler,
                '/api/*': apiHandler(befly.apiRoutes, befly.pluginLists, befly.appContext),
                '/*': staticHandler,
                ...(befly.appOptions.routes || {})
            },
            error: errorHandler
        });

        const finalStartupTime = calcPerfTime(startTime);
        Logger.info(`Befly 服务器启动成功! 服务器启动耗时: ${finalStartupTime}`);
        Logger.info(`服务器监听地址: http://${Env.APP_HOST}:${Env.APP_PORT}`);

        if (callback && typeof callback === 'function') {
            callback(server);
        }

        return server;
    }
}
