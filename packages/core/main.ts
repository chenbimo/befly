/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

// ========== 外部依赖 ==========
import { calcPerfTime } from 'befly-util';

// ========== 相对导入 ==========
import { Logger } from './lib/logger.js';
import { Cipher } from './lib/cipher.js';
import { Jwt } from './lib/jwt.js';
import { Database } from './lib/database.js';
import { DbHelper } from './lib/dbHelper.js';
import { RedisHelper } from './lib/redisHelper.js';
import { loadPlugins } from './loader/loadPlugins.js';
import { loadHooks } from './loader/loadHooks.js';
import { loadApis } from './loader/loadApis.js';
import { apiHandler } from './router/api.js';
import { staticHandler } from './router/static.js';
import { checkApp } from './checks/checkApp.js';
import { checkTable } from './checks/checkTable.js';
import { checkApi } from './checks/checkApi.js';
import { syncAllCommand } from './sync/syncAll.js';
import { coreDir } from './paths.js';
import { defaultOptions } from './config.js';

// ========== 类型导入 ==========
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
    private apis: Map<string, ApiRoute> = new Map();

    /** 插件列表 */
    private plugins: Plugin[] = [];

    /** 钩子列表 */
    private hooks: Hook[] = [];

    /** 应用上下文 */
    public context: BeflyContext = {};

    /** 最终配置（合并默认值后） */
    public config: BeflyOptions = { ...defaultOptions };

    constructor(options: BeflyOptions = {}) {
        // 合并用户配置：用户配置 > 默认配置（最多 2 级）
        for (const key in options) {
            const value = options[key as keyof BeflyOptions];
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    this.config[key as keyof BeflyOptions] = { ...defaultOptions[key as keyof typeof defaultOptions], ...value } as any;
                } else {
                    this.config[key as keyof BeflyOptions] = value as any;
                }
            }
        }
    }

    /**
     * 启动完整的生命周期流程
     * @returns HTTP 服务器实例
     */
    public async start(): Promise<Server> {
        try {
            const serverStartTime = Bun.nanoseconds();

            // 1. 执行启动检查
            await checkApp();
            await checkTable();
            await checkApi();

            // 4. 加载插件
            await loadPlugins(this.config as any, this.plugins, this.context);

            // 5. 加载钩子
            await loadHooks(this.config as any, this.hooks);

            // 6. 加载所有 API
            await loadApis(this.apis);

            // 7. 自动同步 (默认开启)
            await syncAllCommand(this.config);

            // 8. 启动 HTTP 服务器
            const server = Bun.serve({
                port: this.config.appPort,
                hostname: this.config.appHost,
                routes: {
                    '/': () => Response.json({ code: 0, msg: `${this.config.appName} 接口服务已启动` }),
                    '/api/*': apiHandler(this.apis, this.hooks, this.context),
                    '/*': staticHandler(this.config)
                },
                error: (error: Error) => {
                    Logger.error('服务启动时发生错误', error);
                    return Response.json({ code: 1, msg: '内部服务器错误' });
                }
            });

            const finalStartupTime = calcPerfTime(serverStartTime);
            Logger.info(`${this.config.appName} 启动成功! `);
            Logger.info(`服务器启动耗时: ${finalStartupTime}`);
            Logger.info(`服务器监听地址: http://${this.config.appHost}:${this.config.appPort}`);

            // 9. 注册优雅关闭处理
            const gracefulShutdown = async (signal: string) => {
                // 停止接收新请求
                server.stop(true);
                Logger.info('HTTP 服务器已停止');

                // 关闭数据库连接
                try {
                    await Database.disconnect();
                    Logger.info('数据库连接已关闭');
                } catch (error: any) {
                    Logger.error('关闭数据库连接时出错:', error);
                }

                Logger.info('服务器已优雅关闭');
                process.exit(0);
            };

            process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => gracefulShutdown('SIGINT'));

            return server;
        } catch (error: any) {
            Logger.error('Befly 启动失败', error);
            process.exit(1);
        }
    }
}

// 核心类和工具导出
export {
    // 配置
    Logger,
    Cipher,
    Jwt,
    Database,
    DbHelper,
    RedisHelper,
    coreDir
};
