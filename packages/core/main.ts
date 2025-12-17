/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

import type { ApiRoute } from "./types/api.js";
// ========== 类型导入 ==========
import type { BeflyContext, BeflyOptions } from "./types/befly.js";
import type { Hook } from "./types/hook.js";
import type { Plugin } from "./types/plugin.js";

import { checkApi } from "./checks/checkApi.js";
import { checkApp } from "./checks/checkApp.js";
import { checkTable } from "./checks/checkTable.js";
import { Connect } from "./lib/connect.js";
import { Logger } from "./lib/logger.js";
import { loadApis } from "./loader/loadApis.js";
import { loadHooks } from "./loader/loadHooks.js";
import { loadPlugins } from "./loader/loadPlugins.js";
import { apiHandler } from "./router/api.js";
import { staticHandler } from "./router/static.js";
import { syncAllCommand } from "./sync/syncAll.js";
// ========== 相对导入 ==========
import { calcPerfTime } from "./utils/calcPerfTime.js";
import { isPrimaryProcess, getProcessRole } from "./utils/process.js";

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

            // 1. 执行启动检查
            await checkApp();
            await checkTable();
            await checkApi();

            // 2. 加载插件
            await loadPlugins(this.plugins, this.context as BeflyContext);

            // 3. 加载钩子
            await loadHooks(this.hooks);

            // 4. 加载所有 API
            await loadApis(this.apis);

            // 5. 自动同步 (仅主进程执行，避免集群模式下重复执行)
            if (isPrimaryProcess()) {
                await syncAllCommand();
            }

            // 6. 启动 HTTP 服务器
            const server = Bun.serve({
                port: this.config!.appPort,
                hostname: this.config!.appHost,
                // 开发模式下启用详细错误信息
                development: this.config!.nodeEnv === "development",
                // 空闲连接超时时间（秒），防止恶意连接占用资源
                idleTimeout: 30,
                routes: {
                    "/": () => Response.json({ code: 0, msg: `${this.config!.appName} 接口服务已启动` }),
                    "/api/*": apiHandler(this.apis, this.hooks, this.context as BeflyContext),
                    "/*": staticHandler()
                },
                // 未匹配路由的兜底处理
                fetch: () => {
                    return Response.json({ code: 1, msg: "路由未找到" }, { status: 404 });
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
