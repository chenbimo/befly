/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

// ========== 类型导入 ==========
import type { ApiRoute } from "./types/api.js";
import type { BeflyContext, BeflyOptions } from "./types/befly.js";
import type { Hook } from "./types/hook.js";
import type { Plugin } from "./types/plugin.js";

import { checkApi } from "./checks/checkApi.js";
import { checkHook } from "./checks/checkHook.js";
import { checkPlugin } from "./checks/checkPlugin.js";
import { checkTable } from "./checks/checkTable.js";
// ========== 相对导入（项目内部文件） ==========
// 基础设施
import { Connect } from "./lib/connect.js";
import { Logger } from "./lib/logger.js";
// 加载器
import { loadApis } from "./loader/loadApis.js";
import { loadHooks } from "./loader/loadHooks.js";
import { loadPlugins } from "./loader/loadPlugins.js";
// 路由处理
import { apiHandler } from "./router/api.js";
import { staticHandler } from "./router/static.js";
// 同步
import { syncApi } from "./sync/syncApi.js";
import { syncMenu } from "./sync/syncMenu.js";
// 工具
import { calcPerfTime } from "./utils/calcPerfTime.js";
import { getProcessRole } from "./utils/process.js";
import { scanSources } from "./utils/scanSources.js";

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

            // 0. 延迟加载配置（避免循环依赖）
            const { beflyConfig } = await import("./befly.config.js");
            this.config = beflyConfig;

            const { apis, tables, plugins, hooks } = await scanSources();

            await checkApi(apis);
            await checkTable(tables);
            await checkPlugin(plugins);
            await checkHook(hooks);

            // 2. 加载插件
            this.plugins = await loadPlugins(plugins as any, this.context as BeflyContext, this.config!.disablePlugins || []);

            // 5. 自动同步 (仅主进程执行，避免集群模式下重复执行)
            await syncTable();
            await syncApi(apis as any, this.context as BeflyContext);

            await syncMenu(this.context as BeflyContext);
            await syncDev(this.context as BeflyContext);

            // 3. 加载钩子
            this.hooks = await loadHooks(hooks as any, this.config!.disableHooks || []);

            // 4. 加载所有 API
            this.apis = await loadApis(apis as any);

            // 6. 启动 HTTP服务器
            const apiFetch = apiHandler(this.apis, this.hooks, this.context as BeflyContext);
            const staticFetch = staticHandler();

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
