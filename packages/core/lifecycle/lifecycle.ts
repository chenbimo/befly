/**
 * 生命周期管理器
 * 统一管理框架的启动流程：检查、加载插件、加载API、启动服务器
 */

import { Logger } from '../lib/logger.js';
import { Database } from '../lib/database.js';
import { Loader } from './loader.js';
import { Checker } from './checker.js';
import { Env } from '../env.js';
import { calcPerfTime } from '../util.js';
import { Addon } from '../lib/addon.js';
import { Bootstrap } from './bootstrap.js';

import type { Server } from 'bun';
import type { Plugin } from '../types/plugin.js';
import type { ApiRoute } from '../types/api.js';
import type { BeflyContext, BeflyOptions } from '../types/befly.js';

/**
 * 生命周期管理类
 */
export class Lifecycle {
    /** API 路由映射表 */
    private apiRoutes: Map<string, ApiRoute> = new Map();

    /** 插件列表 */
    private pluginLists: Plugin[] = [];

    /** 应用配置选项 */
    private options: BeflyOptions;

    constructor(options: BeflyOptions = {}) {
        this.options = options;
    }

    /**
     * 启动完整的生命周期流程
     * @param appContext - 应用上下文
     * @param callback - 启动完成后的回调函数
     */
    async start(appContext: BeflyContext, callback?: (server: Server) => void): Promise<Server> {
        const serverStartTime = Bun.nanoseconds();

        // 1. 执行系统检查
        await Checker.run();

        // 2. 加载插件
        await Loader.loadPlugins({ pluginLists: this.pluginLists, appContext });

        // 3. 加载所有 API（addon + app）
        await this.loadAllApis();

        // 4. 启动 HTTP 服务器
        const totalStartupTime = calcPerfTime(serverStartTime);

        return await Bootstrap.start(
            {
                apiRoutes: this.apiRoutes,
                pluginLists: this.pluginLists,
                appContext,
                appOptions: this.options
            },
            callback
        );
    }

    /**
     * 加载所有 API 路由
     * 包括 core APIs、addon APIs 和 app APIs
     */
    private async loadAllApis(): Promise<void> {
        // 1. 加载 Core APIs
        try {
            await Loader.loadApis('core', this.apiRoutes, { where: 'core' });
        } catch (error: any) {
            Logger.error(`核心 APIs 加载失败`, error);
            throw error;
        }

        // 2. 加载 addon APIs
        const addons = Addon.scan();

        for (const addon of addons) {
            const hasApis = Addon.dirExists(addon, 'apis');
            if (hasApis) {
                try {
                    await Loader.loadApis(addon, this.apiRoutes, { where: 'addon', addonName: addon });
                } catch (error: any) {
                    Logger.error(`[组件 ${addon}] APIs 加载失败`, error);
                    throw error;
                }
            }
        }

        // 3. 加载用户 APIs
        try {
            await Loader.loadApis('app', this.apiRoutes, { where: 'app' });
        } catch (error: any) {
            Logger.error(`用户 APIs 加载失败`, error);
            throw error;
        }
    }
}
