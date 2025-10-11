/**
 * 生命周期模块类型定义
 */

import type { BeflyContext } from './befly.js';
import type { Plugin } from './plugin.js';
import type { ApiRoute } from './api.js';
import type { Server } from 'bun';

/**
 * Checker 类型
 */
export interface CheckerStatic {
    /**
     * 运行系统检查
     */
    run(): Promise<void>;
}

/**
 * Loader 类型
 */
export interface LoaderStatic {
    /**
     * 加载插件
     * @param befly - Befly实例
     */
    loadPlugins(befly: { pluginLists: Plugin[]; appContext: BeflyContext }): Promise<void>;

    /**
     * 加载API路由
     * @param dirName - 目录名称 ('core' 或 'app')
     * @param apiRoutes - API路由映射表
     */
    loadApis(dirName: string, apiRoutes: Map<string, ApiRoute>): Promise<void>;
}

/**
 * Bootstrap 类型
 */
export interface BootstrapStatic {
    /**
     * 启动HTTP服务器
     * @param befly - Befly实例
     * @param callback - 启动后的回调函数
     */
    start(
        befly: {
            apiRoutes: Map<string, ApiRoute>;
            pluginLists: Plugin[];
            appContext: BeflyContext;
            appOptions: any;
        },
        callback?: (server: Server) => void
    ): Promise<Server>;
}
