/**
 * 生命周期管理器
 * 统一管理框架的启动流程：检查、加载插件、加载API、启动服务器
 */

import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { scanAddons, addonDirExists } from '../utils/framework.js';
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
     * 加载所有 API 路由
     * 包括 addon APIs 和 app APIs
     */
    private async loadAllApis(): Promise<void> {
        Logger.info('========== 开始加载所有 API 路由 ==========');
        const totalLoadStart = Bun.nanoseconds();

        // 加载 addon APIs
        const addons = scanAddons();
        Logger.info(`扫描到 ${addons.length} 个 addon: ${addons.join(', ')}`);

        for (const addon of addons) {
            const addonLoadStart = Bun.nanoseconds();
            const hasApis = addonDirExists(addon, 'apis');
            Logger.info(`[Addon: ${addon}] APIs 目录存在: ${hasApis}`);

            if (hasApis) {
                Logger.info(`[Addon: ${addon}] ===== 开始加载 APIs =====`);
                try {
                    await Loader.loadApis(addon, this.apiRoutes, { isAddon: true, addonName: addon });
                    const addonLoadTime = calcPerfTime(addonLoadStart);
                    Logger.info(`[Addon: ${addon}] ===== APIs 加载完成，耗时: ${addonLoadTime} =====`);
                } catch (error: any) {
                    const addonLoadTime = calcPerfTime(addonLoadStart);
                    Logger.error(`[Addon: ${addon}] !!!!! APIs 加载失败，耗时: ${addonLoadTime} !!!!!`);
                    Logger.error(`[Addon: ${addon}] 错误类型: ${error.name}`);
                    Logger.error(`[Addon: ${addon}] 错误信息: ${error.message}`);
                    if (error.stack) {
                        Logger.error(`[Addon: ${addon}] 错误堆栈:\n${error.stack}`);
                    }
                    throw error; // 重新抛出错误，让上层处理
                }
            }
        }

        Logger.info('========== Addon APIs 全部加载完成 ==========');
        Logger.info('========== 开始加载用户 APIs ==========');

        const userApiLoadStart = Bun.nanoseconds();
        try {
            // 加载 app APIs
            await Loader.loadApis('app', this.apiRoutes);
            const userApiLoadTime = calcPerfTime(userApiLoadStart);
            Logger.info(`========== 用户 APIs 加载完成，耗时: ${userApiLoadTime} ==========`);
        } catch (error: any) {
            const userApiLoadTime = calcPerfTime(userApiLoadStart);
            Logger.error(`!!!!! 用户 APIs 加载失败，耗时: ${userApiLoadTime} !!!!!`);
            Logger.error(`错误类型: ${error.name}`);
            Logger.error(`错误信息: ${error.message}`);
            if (error.stack) {
                Logger.error(`错误堆栈:\n${error.stack}`);
            }
            throw error;
        }

        const totalLoadTime = calcPerfTime(totalLoadStart);
        Logger.info(`========== 所有 API 路由加载完成！总耗时: ${totalLoadTime} ==========`);
    }
}
