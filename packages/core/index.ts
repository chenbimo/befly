/**
 * Befly 框架主入口文件
 * 提供简洁的框架接口，核心逻辑已提取到 loader 层
 */

// ========== 类型导入 ==========
import type { ApiRoute } from "./types/api";
import type { BeflyContext, BeflyOptions } from "./types/befly";
import type { BeflyRuntimeEnv } from "./types/befly";
import type { Hook } from "./types/hook";
import type { Plugin } from "./types/plugin";
import type { ScanFileResult } from "./utils/scanFiles";

import { loadBeflyConfig } from "./befly.config";
import { checkApi } from "./checks/checkApi";
import { checkConfig } from "./checks/checkConfig";
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
import { getProcessRole } from "./utils/processInfo";
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

    private assertStartContextReady(): void {
        const missingCtxKeys: string[] = [];
        if (!this.context.redis) missingCtxKeys.push("ctx.redis");
        if (!this.context.db) missingCtxKeys.push("ctx.db");
        if (!this.context.cache) missingCtxKeys.push("ctx.cache");
        if (missingCtxKeys.length > 0) {
            throw new Error(`启动失败：${missingCtxKeys.join("、")} 未初始化。请检查插件加载与注入顺序。`);
        }
    }

    /**
     * 启动完整的生命周期流程
     * @returns HTTP 服务器实例
     */
    public async start(env: BeflyRuntimeEnv = {}): Promise<ReturnType<typeof Bun.serve>> {
        try {
            const serverStartTime = Bun.nanoseconds();

            // 0. 加载配置
            this.config = await loadBeflyConfig(env["NODE_ENV"] || "development");

            // 配置强校验：阻断错误配置带病启动
            await checkConfig(this.config);

            // 将配置注入到 ctx，供插件/Hook/sync 等按需读取
            this.context.config = this.config;

            // 给插件/Hook/sync 一个统一读取 env 的入口（只从 start 入参注入）
            this.context.env = env;

            const { apis, tables, plugins, hooks, addons } = await scanSources();

            // 让后续 syncMenu 能拿到 addon 的 views 路径等信息
            (this.context as Record<string, unknown>)["addons"] = addons;

            await checkApi(apis);
            await checkTable(tables);
            await checkPlugin(plugins);
            await checkHook(hooks);
            const checkedMenus = await checkMenu(addons);

            // 1. 启动期建立基础连接（SQL + Redis）
            // 说明：连接职责收敛到启动期单点；插件只消费已连接实例（Connect.getSql/getRedis）。
            await Connect.connect({
                db: this.config.db || {},
                redis: this.config.redis || {}
            });

            // 2. 加载插件
            this.plugins = await loadPlugins(plugins as ScanFileResult[], this.context as BeflyContext);

            // 启动期依赖完整性检查：避免 sync 阶段出现 undefined 调用
            // 注意：这里不做兼容别名（例如 dbHelper=db），要求上下文必须注入标准字段。
            this.assertStartContextReady();

            // 5. 自动同步 (仅主进程执行，避免集群模式下重复执行)
            await syncTable(this.context as BeflyContext, tables);
            await syncApi(this.context as BeflyContext, apis);

            await syncMenu(this.context as BeflyContext, checkedMenus);
            const devEmail = this.config.devEmail;
            const devPassword = this.config.devPassword;
            if (typeof devEmail === "string" && devEmail.length > 0 && typeof devPassword === "string" && devPassword.length > 0) {
                await syncDev(this.context as BeflyContext, { devEmail: devEmail, devPassword: devPassword });
            } else {
                Logger.debug("跳过 syncDev：未配置 devEmail/devPassword");
            }

            // 缓存同步：统一在所有同步完成后执行（cacheApis + cacheMenus + rebuildRoleApiPermissions）
            await syncCache(this.context as BeflyContext);

            // 3. 加载钩子
            this.hooks = await loadHooks(hooks as ScanFileResult[]);

            // 4. 加载所有 API
            this.apis = await loadApis(apis as ScanFileResult[]);

            // 6. 启动 HTTP服务器
            const apiFetch = apiHandler(this.apis, this.hooks, this.context as BeflyContext);
            const staticFetch = staticHandler(this.config!.cors);

            const port = typeof this.config!.appPort === "number" ? this.config!.appPort : 3000;
            const hostname = typeof this.config!.appHost === "string" && this.config!.appHost.length > 0 ? this.config!.appHost : "0.0.0.0";

            const server = Bun.serve({
                port: port,
                hostname: hostname,
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
                    Logger.error({ err: error, msg: "服务启动时发生错误" });
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
            const processRole = getProcessRole(env);
            const roleLabel = processRole.role === "primary" ? "主进程" : `工作进程 #${processRole.instanceId}`;
            const envLabel = processRole.env === "standalone" ? "" : ` [${processRole.env}]`;

            Logger.info(`${this.config!.appName} 启动成功! (${roleLabel}${envLabel})`);
            Logger.info(`服务器启动耗时: ${finalStartupTime}`);
            Logger.info(`服务器监听地址: ${server.url}`);
            // 注意：作为库代码，这里不注册 SIGINT/SIGTERM 处理器，也不调用 process.exit。
            // 宿主应用应自行处理信号并决定退出策略（包括是否调用 server.stop / Connect.disconnect / Logger.flush）。
            return server;
        } catch (error: unknown) {
            // 注意：这里不能直接 process.exit(1)
            // - Logger 是异步缓冲写入，exit 会导致日志来不及 flush（实际项目里表现为“完全没打印”）
            // - 作为库代码，也不应该强行终止宿主进程
            Logger.error({ err: error, msg: "项目启动失败" });

            // 尽力把错误日志落盘/输出后再把异常抛给上层。
            try {
                await Logger.flush();
            } catch {
                // ignore
            }

            try {
                await Logger.shutdown();
            } catch {
                // ignore
            }

            if (error instanceof Error) {
                throw error;
            }
            throw new Error(String(error));
        }
    }
}
