/**
 * 生命周期管理器
 * 统一管理框架的启动流程：检查、加载插件、加载API、启动服务器
 */

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import { loadPlugins } from './loadPlugins.js';
import { loadApis } from './loadApis.js';
import { Checker } from './checker.js';
import { Env } from '../env.js';
import { calcPerfTime } from '../util.js';
import { Addon } from '../lib/addon.js';
import { Bootstrap } from './bootstrap.js';

import type { Server } from 'bun';
import type { Plugin } from '../types/plugin.js';
import type { ApiRoute } from '../types/api.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 生命周期管理类
 */
export class Lifecycle {
    /** API 路由映射表 */
    private apiRoutes: Map<string, ApiRoute> = new Map();

    /** 插件列表 */
    private pluginLists: Plugin[] = [];

    constructor() {}

    /**
     * 启动完整的生命周期流程
     * @param appContext - 应用上下文
     */
    async start(appContext: BeflyContext): Promise<Server> {
        const serverStartTime = Bun.nanoseconds();

        // 1. 执行系统检查
        await Checker.run();

        // 2. 加载插件
        await loadPlugins({
            pluginLists: this.pluginLists,
            appContext: appContext
        });

        // // 3. 加载所有 API
        await loadApis(this.apiRoutes);

        // 4. 启动 HTTP 服务器
        const totalStartupTime = calcPerfTime(serverStartTime);

        return await Bootstrap.start({
            apiRoutes: this.apiRoutes,
            pluginLists: this.pluginLists,
            appContext: appContext
        });
    }
}
