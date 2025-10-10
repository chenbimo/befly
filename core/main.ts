/**
 * Befly 框架主入口 - TypeScript 版本
 * 核心框架类和导出
 */

import path from 'node:path';
import { Env } from './config/env.js';
import { Api } from './utils/api.js';
import { Logger } from './utils/logger.js';
import { Jwt } from './utils/jwt.js';
import { Validator } from './utils/validate.js';
import { Crypto } from './utils/crypto.js';
import { Xml } from './utils/xml.js';
import { __dirchecks, __dirplugins, __dirapis, getProjectDir } from './system.js';
import { isEmptyObject, isType, pickFields, sortPlugins, Yes, No, filterLogFields, setCorsOptions, calcPerfTime } from './utils/index.js';
import type { Plugin } from './types/plugin.js';
import type { ApiRoute } from './types/api.js';
import type { BeflyContext } from './types/befly.js';

/**
 * Befly 选项接口
 */
export interface BeflyOptions {
    /** 自定义路由 */
    routes?: Record<string, (req: Request) => Response | Promise<Response>>;
    /** 服务器端口 */
    port?: number;
    /** 服务器主机 */
    hostname?: string;
    /** 是否跳过检查 */
    skipCheck?: boolean;
}

/**
 * Befly 框架核心类
 */
export class Befly {
    /** API 路由映射 */
    private apiRoutes: Map<string, ApiRoute>;
    /** 插件列表 */
    private pluginLists: Plugin[];
    /** 应用上下文 */
    public appContext: BeflyContext;
    /** 应用选项 */
    private appOptions: BeflyOptions;

    /**
     * 构造函数
     * @param options - 配置选项
     */
    constructor(options: BeflyOptions = {}) {
        this.apiRoutes = new Map();
        this.pluginLists = [];
        this.appContext = {} as BeflyContext;
        this.appOptions = options;
    }

    /**
     * 初始化检查
     */
    async initCheck(): Promise<void> {
        try {
            const checkStartTime = Bun.nanoseconds();
            const glob = new Bun.Glob('*.{js,ts}');

            let totalChecks = 0;
            let passedChecks = 0;
            let failedChecks = 0;

            // 扫描并执行检查函数
            for await (const file of glob.scan({
                cwd: __dirchecks,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file);
                if (fileName.startsWith('_')) continue;

                try {
                    totalChecks++;
                    const singleCheckStart = Bun.nanoseconds();

                    // 导入检查模块
                    const checkModule = await import(file);

                    // 查找检查函数（具名导出，以 check 开头）
                    let checkFn: ((context: BeflyContext) => Promise<boolean>) | null = null;
                    for (const [exportName, exportValue] of Object.entries(checkModule)) {
                        if (typeof exportValue === 'function' && /^check/i.test(exportName)) {
                            checkFn = exportValue as typeof checkFn;
                            break;
                        }
                    }

                    // 执行检查函数
                    if (typeof checkFn === 'function') {
                        const checkResult = await checkFn(this.appContext);
                        const singleCheckTime = calcPerfTime(singleCheckStart);

                        if (checkResult === true) {
                            passedChecks++;
                            Logger.info(`检查 ${fileName} 通过，耗时: ${singleCheckTime}`);
                        } else {
                            Logger.error(`检查未通过: ${fileName}，耗时: ${singleCheckTime}`);
                            failedChecks++;
                        }
                    } else {
                        const singleCheckTime = calcPerfTime(singleCheckStart);
                        Logger.warn(`文件 ${fileName} 未找到可执行的检查函数，耗时: ${singleCheckTime}`);
                        failedChecks++;
                    }
                } catch (error: any) {
                    Logger.error({
                        msg: `检查失败 ${fileName}`,
                        error: error.message,
                        stack: error.stack
                    });
                    failedChecks++;
                }
            }

            const totalCheckTime = calcPerfTime(checkStartTime);
            Logger.info(`系统检查完成! 总耗时: ${totalCheckTime}，总检查数: ${totalChecks}, 通过: ${passedChecks}, 失败: ${failedChecks}`);

            if (failedChecks > 0) {
                Logger.error('系统检查失败，终止启动');
                process.exit(1);
            } else if (totalChecks > 0) {
                Logger.info('所有系统检查通过!');
            } else {
                Logger.info('未执行任何检查');
            }
        } catch (error: any) {
            Logger.error({
                msg: '执行系统检查时发生错误',
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    /**
     * 加载插件
     */
    async loadPlugins(): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const glob = new Bun.Glob('*.{js,ts}');
            const corePlugins: Plugin[] = [];
            const userPlugins: Plugin[] = [];
            const loadedPluginNames = new Set<string>();
            let hadPluginError = false;

            // 扫描核心插件
            const corePluginsScanStart = Bun.nanoseconds();
            for await (const file of glob.scan({
                cwd: __dirplugins,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                if (fileName.startsWith('_')) continue;

                try {
                    const importStart = Bun.nanoseconds();
                    const plugin = await import(file);
                    const importTime = calcPerfTime(importStart);

                    const pluginInstance: Plugin = plugin.default;
                    if (!pluginInstance.name) {
                        pluginInstance.name = fileName;
                    }
                    corePlugins.push(pluginInstance);
                    loadedPluginNames.add(fileName);

                    Logger.info(`核心插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err: any) {
                    hadPluginError = true;
                    Logger.error({
                        msg: `核心插件 ${fileName} 导入失败`,
                        error: err.message,
                        stack: err.stack
                    });
                }
            }
            const corePluginsScanTime = calcPerfTime(corePluginsScanStart);
            Logger.info(`核心插件扫描完成，耗时: ${corePluginsScanTime}，共找到 ${corePlugins.length} 个插件`);

            // 排序核心插件
            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                Logger.error('插件依赖关系错误，请检查插件的 after 属性');
                process.exit(1);
            }

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedCorePlugins) {
                try {
                    this.pluginLists.push(plugin);
                    const pluginName = plugin.name || 'unknown';
                    if (typeof plugin.onInit === 'function') {
                        this.appContext[pluginName] = await plugin.onInit(this.appContext);
                    } else {
                        this.appContext[pluginName] = {};
                    }
                } catch (error: any) {
                    hadPluginError = true;
                    Logger.warn(`插件 ${plugin.name} 初始化失败: ${error.message}`);
                }
            }
            const corePluginsInitTime = calcPerfTime(corePluginsInitStart);
            Logger.info(`核心插件初始化完成，耗时: ${corePluginsInitTime}`);

            // 扫描用户插件
            const userPluginsScanStart = Bun.nanoseconds();
            for await (const file of glob.scan({
                cwd: getProjectDir('plugins'),
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                if (fileName.startsWith('_')) continue;

                // 检查是否已有同名核心插件
                if (loadedPluginNames.has(fileName)) {
                    Logger.info(`跳过用户插件 ${fileName}，因为同名的核心插件已存在`);
                    continue;
                }

                try {
                    const importStart = Bun.nanoseconds();
                    const plugin = await import(file);
                    const importTime = calcPerfTime(importStart);

                    const pluginInstance: Plugin = plugin.default;
                    if (!pluginInstance.name) {
                        pluginInstance.name = fileName;
                    }
                    userPlugins.push(pluginInstance);

                    Logger.info(`用户插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err: any) {
                    hadPluginError = true;
                    Logger.error({
                        msg: `用户插件 ${fileName} 导入失败`,
                        error: err.message,
                        stack: err.stack
                    });
                }
            }
            const userPluginsScanTime = calcPerfTime(userPluginsScanStart);
            Logger.info(`用户插件扫描完成，耗时: ${userPluginsScanTime}，共找到 ${userPlugins.length} 个插件`);

            // 排序用户插件
            const sortedUserPlugins = sortPlugins(userPlugins);
            if (sortedUserPlugins === false) {
                Logger.error('用户插件依赖关系错误');
                process.exit(1);
            }

            // 初始化用户插件
            const userPluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedUserPlugins) {
                try {
                    this.pluginLists.push(plugin);
                    const pluginName = plugin.name || 'unknown';
                    if (typeof plugin.onInit === 'function') {
                        this.appContext[pluginName] = await plugin.onInit(this.appContext);
                    } else {
                        this.appContext[pluginName] = {};
                    }
                } catch (error: any) {
                    hadPluginError = true;
                    Logger.warn(`用户插件 ${plugin.name} 初始化失败: ${error.message}`);
                }
            }
            const userPluginsInitTime = calcPerfTime(userPluginsInitStart);
            Logger.info(`用户插件初始化完成，耗时: ${userPluginsInitTime}`);

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`所有插件加载完成，总耗时: ${totalLoadTime}`);

            if (hadPluginError) {
                Logger.warn('部分插件加载失败，但框架继续启动');
            }
        } catch (error: any) {
            Logger.error({
                msg: '插件加载过程中发生错误',
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    /**
     * 加载 API 路由
     */
    async loadApis(): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const glob = new Bun.Glob('**/*.{js,ts}');

            let totalApis = 0;

            // 加载核心 API
            for await (const file of glob.scan({
                cwd: __dirapis,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                if (fileName.startsWith('_')) continue;

                try {
                    const apiModule = await import(file);
                    const apiRoute: ApiRoute = apiModule.default;

                    if (apiRoute && apiRoute.handler) {
                        const routePath = path
                            .relative(__dirapis, file)
                            .replace(/\.(js|ts)$/, '')
                            .replace(/\\/g, '/');
                        this.apiRoutes.set(`/${routePath}`, apiRoute);
                        totalApis++;
                        Logger.info(`加载核心 API: /${routePath}`);
                    }
                } catch (err: any) {
                    Logger.error({
                        msg: `加载核心 API 失败: ${file}`,
                        error: err.message,
                        stack: err.stack
                    });
                }
            }

            // 加载项目 API
            for await (const file of glob.scan({
                cwd: getProjectDir('apis'),
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                if (fileName.startsWith('_')) continue;

                try {
                    const apiModule = await import(file);
                    const apiRoute: ApiRoute = apiModule.default;

                    if (apiRoute && apiRoute.handler) {
                        const routePath = path
                            .relative(getProjectDir('apis'), file)
                            .replace(/\.(js|ts)$/, '')
                            .replace(/\\/g, '/');
                        this.apiRoutes.set(`/${routePath}`, apiRoute);
                        totalApis++;
                        Logger.info(`加载项目 API: /${routePath}`);
                    }
                } catch (err: any) {
                    Logger.error({
                        msg: `加载项目 API 失败: ${file}`,
                        error: err.message,
                        stack: err.stack
                    });
                }
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`API 加载完成，总耗时: ${totalLoadTime}，共加载 ${totalApis} 个接口`);
        } catch (error: any) {
            Logger.error({
                msg: 'API 加载过程中发生错误',
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    /**
     * 启动服务器
     */
    async listen(callback?: (server: any) => void): Promise<void> {
        try {
            const serverStartTime = Bun.nanoseconds();

            // 执行检查
            if (!this.appOptions.skipCheck) {
                await this.initCheck();
            }

            // 加载插件
            await this.loadPlugins();

            // 加载 API
            await this.loadApis();

            // 创建服务器
            const server = Bun.serve({
                port: this.appOptions.port || Env.APP_PORT,
                hostname: this.appOptions.hostname || Env.APP_HOST,
                fetch: async (req: Request) => {
                    const url = new URL(req.url);
                    const pathname = url.pathname;

                    // CORS 预检请求
                    if (req.method === 'OPTIONS') {
                        return new Response(null, setCorsOptions(req));
                    }

                    // 查找路由
                    const apiRoute = this.apiRoutes.get(pathname);
                    if (apiRoute) {
                        try {
                            const ctx: any = { req, url, pathname };
                            const result = await apiRoute.handler(this.appContext as any, ctx, req);
                            return Response.json(result, setCorsOptions(req));
                        } catch (error: any) {
                            Logger.error({
                                msg: `API 处理错误: ${pathname}`,
                                error: error.message,
                                stack: error.stack
                            });
                            return Response.json(No('内部服务器错误'), setCorsOptions(req));
                        }
                    }

                    // 404
                    return Response.json(No('接口不存在'), {
                        ...setCorsOptions(req),
                        status: 404
                    });
                },
                error(error: Error) {
                    Logger.error({
                        msg: '服务启动时发生错误',
                        error: error.message,
                        stack: error.stack
                    });
                    return Response.json(No('内部服务器错误'));
                }
            });

            const finalStartupTime = calcPerfTime(serverStartTime);
            Logger.info(`Befly 服务器启动成功! 完整启动耗时: ${finalStartupTime}`);
            Logger.info(`服务器监听地址: http://${Env.APP_HOST}:${Env.APP_PORT}`);

            if (callback && typeof callback === 'function') {
                callback(server);
            }
        } catch (error: any) {
            Logger.error({
                msg: '服务器启动失败',
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }
}

// 导出核心模块
export { Env, Api, Jwt, Validator, Crypto, Xml, Logger, Yes, No };
export type { BeflyOptions };
