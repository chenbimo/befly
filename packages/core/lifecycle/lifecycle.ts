/**
 * 生命周期管理器
 * 统一管理框架的启动流程：检查、加载插件、加载API、启动服务器
 */

import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { scanAddons, hasAddonDir } from '../utils/addonHelper.js';
import { Checker } from './checker.js';
import { Loader } from './loader.js';
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
    async start(appContext: BeflyContext, callback?: (server: Server) => void): Promise<void> {
        const serverStartTime = Bun.nanoseconds();
        Logger.info('开始启动 Befly 服务器...');

        // 1. 执行系统检查
        await Checker.run();

        // 2. 加载插件
        await Loader.loadPlugins({ pluginLists: this.pluginLists, appContext });

        // 3. 加载所有 API（addon + app）
        await this.loadAllApis();

        // 4. 启动 HTTP 服务器
        const totalStartupTime = calcPerfTime(serverStartTime);
        Logger.info(`服务器启动准备完成，总耗时: ${totalStartupTime}`);

        await Bootstrap.start(
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
     * 加载所有 API
     * 包括 addon APIs 和 app APIs
     */
    private async loadAllApis(): Promise<void> {
        // 加载 addon APIs
        const addons = scanAddons();
        for (const addon of addons) {
            if (hasAddonDir(addon, 'apis')) {
                await Loader.loadApis(addon, this.apiRoutes, { isAddon: true, addonName: addon });
            }
        }

        // 加载 app APIs
        await Loader.loadApis('app', this.apiRoutes);
    }
}
