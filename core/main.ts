/**
 * Befly 框架主入口文件 - TypeScript 版本
 * 提供完整的框架功能：检查系统、加载插件、加载 API、启动 HTTP 服务器
 */

import { Env } from './config/env.js';
import { Api } from './utils/api.js';
import { Yes, No } from './utils/index.js';
import { Logger } from './utils/logger.js';
import { Jwt } from './utils/jwt.js';
import { Validator } from './utils/validate.js';
import { Crypto2 } from './utils/crypto.js';
import { calcPerfTime } from './utils/index.js';
import { Checker } from './lifecycle/checker.js';
import { Loader } from './lifecycle/loader.js';
import { Bootstrap } from './lifecycle/bootstrap.js';

import type { Server } from 'bun';
import type { Plugin } from './types/plugin.js';
import type { ApiRoute, ApiHandler } from './types/api.js';
import type { BeflyContext, BeflyOptions, RequestContext } from './types/befly.js';

/**
 * Befly 框架核心类
 */
export class Befly {
    /** API 路由映射表 */
    private apiRoutes: Map<string, ApiRoute>;

    /** 插件列表 */
    private pluginLists: Plugin[];

    /** 应用上下文 */
    public appContext: BeflyContext;

    /** 应用配置选项 */
    private appOptions: BeflyOptions;

    // 原构造函数被替换
    constructor(options: BeflyOptions = {}) {
        this.apiRoutes = new Map();
        this.pluginLists = [];
        this.appContext = {};
        this.appOptions = options;
    }

    /**
     * 系统检查（已提取到 lifecycle/checker.ts）
     */
    async initCheck(): Promise<void> {
        await Checker.run();
    }

    /**
     * 加载插件（已提取到 lifecycle/loader.ts）
     */
    async loadPlugins(): Promise<void> {
        await Loader.loadPlugins(this);
    }

    /**
     * 加载API路由（已提取到 lifecycle/loader.ts）
     */
    async loadApis(dirName: string): Promise<void> {
        await Loader.loadApis(dirName, this.apiRoutes);
    }

    /**
     * 启动服务器
     */
    async listen(callback?: (server: Server) => void): Promise<void> {
        const serverStartTime = Bun.nanoseconds();
        Logger.info('开始启动 Befly 服务器...');

        // 执行启动前的检查和加载
        await this.initCheck();
        await this.loadPlugins();
        await this.loadApis('core');
        await this.loadApis('app');

        const totalStartupTime = calcPerfTime(serverStartTime);
        Logger.info(`服务器启动准备完成，总耗时: ${totalStartupTime}`);

        // 启动HTTP服务器（路由处理逻辑已提取到 router/*.ts）
        await Bootstrap.start(this, callback);
    }
}

// 核心类已通过 export class 导出
export { Env, Api, Jwt, Validator, Crypto2, Logger, Yes, No };
