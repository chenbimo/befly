/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

// ========== 类型导入 ==========
import type { ApiRoute } from "./types/api";
import type { BeflyContext, BeflyOptions } from "./types/befly";
import type { Hook } from "./types/hook";
import type { Plugin } from "./types/plugin";

import { loadBeflyConfig } from "./befly.config";
import { checkApi } from "./checks/checkApi";
import { checkHook } from "./checks/checkHook";
import { checkMenu } from "./checks/checkMenu";
import { checkPlugin } from "./checks/checkPlugin";
import { checkTable } from "./checks/checkTable";
// ========== 相对导入（项目内部文件） ==========
// 基础设施
import { Connect } from "./lib/connect";
import { Logger } from "./lib/logger";
// 加载器
import { loadApis } from "./loader/loadApis";
import { loadHooks } from "./loader/loadHooks";
import { loadPlugins } from "./loader/loadPlugins";
// 路由处理
import { apiHandler } from "./router/api";
import { staticHandler } from "./router/static";
// 同步
import { syncApi } from "./sync/syncApi";
import { syncCache } from "./sync/syncCache";
import { syncDev } from "./sync/syncDev";
import { syncMenu } from "./sync/syncMenu";
import { syncTable } from "./sync/syncTable";
// 工具
import { calcPerfTime } from "./utils/calcPerfTime";
import { getProcessRole } from "./utils/process";
import { scanSources } from "./utils/scanSources";

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
    public context: Partial<BeflyContext> = {};

    /** 配置引用（延迟加载） */
    private config: BeflyOptions | null = null;

    /**
     * 启动完整的生命周期流程
     * @returns HTTP 服务器实例
     */
    public async start(): Promise<ReturnType<typeof Bun.serve>> {
        try {
            const serverStartTime = Bun.nanoseconds();

            // 0. 加载配置
            this.config = await loadBeflyConfig();

            // 将配置注入到 ctx，供插件/Hook/sync 等按需读取
            this.context.config = this.config;

            const { apis, tables, plugins, hooks, addons } = await scanSources();

            // 让后续 syncMenu 能拿到 addon 的 views 路径等信息
            this.context.addons = addons;

            await checkApi(apis);
            await checkTable(tables);
            await checkPlugin(plugins);
            await checkHook(hooks);
            const checkedMenus = await checkMenu(addons, { disableMenus: this.config.disableMenus || [] });

            // 1. 启动期建立基础连接（SQL + Redis）
            // 说明：连接职责收敛到启动期单点；插件只消费已连接实例（Connect.getSql/getRedis）。
            await Connect.connect({
                db: this.config.db || {},
                redis: this.config.redis || {}
            });

            // 2. 加载插件
            this.plugins = await loadPlugins(plugins as any, this.context as BeflyContext);

            // 启动期依赖完整性检查：避免 sync 阶段出现 undefined 调用
            // 注意：这里不做兼容别名（例如 dbHelper=db），要求上下文必须注入标准字段。
            if (!(this.context as any).redis) {
                throw new Error("启动失败：ctx.redis 未初始化（Redis 插件未加载或注入失败）");
            }
            if (!(this.context as any).db) {
                throw new Error("启动失败：ctx.db 未初始化（Db 插件未加载或注入失败）");
            }
            if (!(this.context as any).cache) {
                throw new Error("启动失败：ctx.cache 未初始化（cache 插件未加载或注入失败）");
            }

            // 5. 自动同步 (仅主进程执行，避免集群模式下重复执行)
            await syncTable(this.context as BeflyContext, tables);
            await syncApi(this.context as BeflyContext, apis as any);

            await syncMenu(this.context as BeflyContext, checkedMenus);
            await syncDev(this.context as BeflyContext, { devEmail: this.config.devEmail, devPassword: this.config.devPassword });

            // 缓存同步：统一在所有同步完成后执行（cacheApis + cacheMenus + rebuildRoleApiPermissions）
            await syncCache(this.context as BeflyContext);

            // 3. 加载钩子
            this.hooks = await loadHooks(hooks as any);

            // 4. 加载所有 API
            this.apis = await loadApis(apis as any);

            // 6. 启动 HTTP服务器
            const apiFetch = apiHandler(this.apis, this.hooks, this.context as BeflyContext);
            const staticFetch = staticHandler(this.config!.cors);

            const server = Bun.serve({
                port: this.config!.appPort,
                hostname: this.config!.appHost,
                // 开发模式下启用详细错误信息
                development: this.config!.nodeEnv === "development",
                // 空闲连接超时时间（秒），防止恶意连接占用资源
                idleTimeout: 30,
                fetch: async (req, bunServer) => {
                    const url = new URL(req.url);

                    if (url.pathname === "/") {
                        return Response.json({ code: 0, msg: `${this.config!.appName} 接口服务已启动` });
                    }

                    if (url.pathname.startsWith("/api/")) {
                        return apiFetch(req, bunServer);
                    }

                    return staticFetch(req);
                },
                error: (error: Error) => {
                    Logger.error({ err: error }, "服务启动时发生错误");
                    // 开发模式下返回详细错误信息
                    if (this.config!.nodeEnv === "development") {
                        return Response.json(
                            {
                                code: 1,
                                msg: "内部服务器错误",
                                error: error.message,
                                stack: error.stack
                            },
                            { status: 200 }
                        );
                    }
                    return Response.json({ code: 1, msg: "内部服务器错误" }, { status: 200 });
                }
            });

            const finalStartupTime = calcPerfTime(serverStartTime);
            const processRole = getProcessRole();
            const roleLabel = processRole.role === "primary" ? "主进程" : `工作进程 #${processRole.instanceId}`;
            const envLabel = processRole.env === "standalone" ? "" : ` [${processRole.env}]`;

            Logger.info(`${this.config!.appName} 启动成功! (${roleLabel}${envLabel})`);
            Logger.info(`服务器启动耗时: ${finalStartupTime}`);
            Logger.info(`服务器监听地址: ${server.url}`);

            // 7. 注册优雅关闭处理
            const gracefulShutdown = async (signal: string) => {
                Logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

                // 优雅停止（等待进行中的请求完成）
                try {
                    await server.stop();
                    Logger.info("HTTP 服务器已停止");
                } catch (error: any) {
                    Logger.error({ err: error }, "停止 HTTP 服务器时出错");
                }

                // 关闭数据库连接
                try {
                    await Connect.disconnect();
                    Logger.info("数据库连接已关闭");
                } catch (error: any) {
                    Logger.error({ err: error }, "关闭数据库连接时出错");
                }

                Logger.info("服务器已优雅关闭");
                process.exit(0);
            };

            process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
            process.on("SIGINT", () => gracefulShutdown("SIGINT"));

            return server;
        } catch (error: any) {
            Logger.error({ err: error }, "项目启动失败");
            process.exit(1);
        }
    }
}
