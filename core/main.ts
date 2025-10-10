/**
 * Befly 框架主入口文件 - TypeScript 版本
 * 提供完整的框架功能：检查系统、加载插件、加载 API、启动 HTTP 服务器
 */

import path from 'node:path';
import { Env } from './config/env.js';
import { Api } from './utils/api.js';
import { Logger } from './utils/logger.js';
import { Jwt } from './utils/jwt.js';
import { Validator } from './utils/validate.js';
const validator = new Validator();
import { Crypto } from './utils/crypto.js';
const Crypto2 = Crypto; // 兼容别名
import { Xml } from './utils/xml.js';
import { SyncDb } from './scripts/syncDb.js';
import { __dirchecks, __dirplugins, __dirapis, getProjectDir } from './system.js';
import { isEmptyObject, isType, pickFields, sortPlugins, Yes, No, filterLogFields, setCorsOptions, calcPerfTime } from './utils/index.js';

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

    async initCheck(): Promise<void> {
        try {
            const checkStartTime = Bun.nanoseconds();

            const glob = new Bun.Glob('*.{js,ts}');

            // 统计信息
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
                if (fileName.startsWith('_')) continue; // 跳过以下划线开头的文件

                try {
                    totalChecks++;
                    const singleCheckStart = Bun.nanoseconds();

                    // 导入检查模块
                    const checkModule = await import(file);

                    // 仅允许具名导出（以 check 开头）的检查函数
                    let checkFn = null;
                    for (const [exportName, exportValue] of Object.entries(checkModule)) {
                        if (typeof exportValue === 'function' && /^check/i.test(exportName)) {
                            checkFn = exportValue;
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
                        Logger.warn(`文件 ${fileName} 未找到可执行的检查函数（必须具名导出以 check 开头的函数），耗时: ${singleCheckTime}`);
                        failedChecks++;
                    }
                } catch (error: any) {
                    const singleCheckTime = calcPerfTime(singleCheckStart);
                    Logger.error({
                        msg: `检查失败 ${fileName}，耗时: ${singleCheckTime}`,
                        error: error.message,
                        stack: error.stack
                    });
                    failedChecks++;
                }
            }

            const totalCheckTime = calcPerfTime(checkStartTime);

            // 输出检查结果统计
            Logger.info(`系统检查完成! 总耗时: ${totalCheckTime}，总检查数: ${totalChecks}, 通过: ${passedChecks}, 失败: ${failedChecks}`);

            if (failedChecks > 0) {
                process.exit();
            } else if (totalChecks > 0) {
                Logger.info(`所有系统检查通过!`);
            } else {
                Logger.info(`未执行任何检查`);
            }
        } catch (error: any) {
            Logger.error({
                msg: '执行系统检查时发生错误',
                error: error.message,
                stack: error.stack
            });
            process.exit();
        }
    }

    async loadPlugins(): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();

            const glob = new Bun.Glob('*.{js,ts}');
            const corePlugins = [];
            const userPlugins = [];
            const loadedPluginNames = new Set(); // 用于跟踪已加载的插件名称
            let hadPluginError = false; // 统一记录插件阶段是否有错误

            // 扫描核心插件目录
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

                    const pluginInstance = plugin.default;
                    pluginInstance.pluginName = fileName;
                    corePlugins.push(pluginInstance);
                    loadedPluginNames.add(fileName); // 记录已加载的核心插件名称

                    Logger.info(`核心插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err) {
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

            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                Logger.error(`插件依赖关系错误，请检查插件的 after 属性`);
                process.exit();
            }

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedCorePlugins) {
                try {
                    this.pluginLists.push(plugin);
                    this.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(this.appContext) : {};
                } catch (error: any) {
                    hadPluginError = true;
                    Logger.warn(`插件 ${plugin.pluginName} 初始化失败: ${error.message}`);
                }
            }
            const corePluginsInitTime = calcPerfTime(corePluginsInitStart);
            Logger.info(`核心插件初始化完成，耗时: ${corePluginsInitTime}`);

            // 扫描用户插件目录
            const userPluginsScanStart = Bun.nanoseconds();
            for await (const file of glob.scan({
                cwd: getProjectDir('plugins'),
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                if (fileName.startsWith('_')) continue;

                // 检查是否已经加载了同名的核心插件
                if (loadedPluginNames.has(fileName)) {
                    Logger.info(`跳过用户插件 ${fileName}，因为同名的核心插件已存在`);
                    continue;
                }

                try {
                    const importStart = Bun.nanoseconds();
                    const plugin = await import(file);
                    const importTime = calcPerfTime(importStart);

                    const pluginInstance = plugin.default;
                    pluginInstance.pluginName = fileName;
                    userPlugins.push(pluginInstance);

                    Logger.info(`用户插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err) {
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

            const sortedUserPlugins = sortPlugins(userPlugins);
            if (sortedUserPlugins === false) {
                Logger.error(`插件依赖关系错误，请检查插件的 after 属性`);
                process.exit();
            }

            // 初始化用户插件
            if (userPlugins.length > 0) {
                const userPluginsInitStart = Bun.nanoseconds();
                for (const plugin of sortedUserPlugins) {
                    try {
                        this.pluginLists.push(plugin);
                        this.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(this.appContext) : {};
                    } catch (error: any) {
                        hadPluginError = true;
                        Logger.warn(`插件 ${plugin.pluginName} 初始化失败: ${error.message}`);
                    }
                }
                const userPluginsInitTime = calcPerfTime(userPluginsInitStart);
                Logger.info(`用户插件初始化完成，耗时: ${userPluginsInitTime}`);
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            const totalPluginCount = sortedCorePlugins.length + sortedUserPlugins.length;
            Logger.info(`插件加载完成! 总耗时: ${totalLoadTime}，共加载 ${totalPluginCount} 个插件`);

            // 如果任意插件导入或初始化失败，统一退出进程
            if (hadPluginError) {
                Logger.error('检测到插件导入或初始化失败，进程即将退出');
                process.exit(1);
            }
        } catch (error: any) {
            Logger.error({
                msg: '加载插件时发生错误',
                error: error.message,
                stack: error.stack
            });
            // 兜底退出，避免服务在插件阶段异常后继续运行
            process.exit(1);
        }
    }
    async loadApis(dirName: string): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const dirDisplayName = dirName === 'core' ? '核心' : '用户';

            const glob = new Bun.Glob('**/*.js');
            const apiDir = dirName === 'core' ? __dirapis : getProjectDir('apis');

            let totalApis = 0;
            let loadedApis = 0;
            let failedApis = 0;

            // 扫描指定目录
            for await (const file of glob.scan({
                cwd: apiDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file).replace(/\.(js|ts)$/, '');
                const apiPath = path.relative(apiDir, file).replace(/\.js$/, '').replace(/\\/g, '/');
                if (apiPath.indexOf('_') !== -1) continue;

                totalApis++;
                const singleApiStart = Bun.nanoseconds();

                try {
                    const api = (await import(file)).default;
                    if (isType(api.name, 'string') === false || api.name.trim() === '') {
                        throw new Error(`接口 ${apiPath} 的 name 属性必须是非空字符串`);
                    }
                    if (isType(api.auth, 'boolean') === false && isType(api.auth, 'array') === false && isType(api.auth, 'string') === false) {
                        throw new Error(`接口 ${apiPath} 的 auth 属性必须是布尔值或字符串或字符串数组`);
                    }
                    if (isType(api.fields, 'object') === false) {
                        throw new Error(`接口 ${apiPath} 的 fields 属性必须是对象`);
                    }
                    if (isType(api.required, 'array') === false) {
                        throw new Error(`接口 ${apiPath} 的 required 属性必须是数组`);
                    }
                    // 数组的每一项都必须是字符串
                    if (api.required.some((item) => isType(item, 'string') === false)) {
                        throw new Error(`接口 ${apiPath} 的 required 属性必须是字符串数组`);
                    }
                    if (isType(api.handler, 'function') === false) {
                        throw new Error(`接口 ${apiPath} 的 handler 属性必须是函数`);
                    }
                    api.route = `${api.method.toUpperCase()}/api/${dirName}/${apiPath}`;
                    this.apiRoutes.set(api.route, api);

                    const singleApiTime = calcPerfTime(singleApiStart);
                    loadedApis++;
                    // Logger.info(`${dirDisplayName}接口 ${apiPath} 加载成功，耗时: ${singleApiTime}`);
                } catch (error: any) {
                    const singleApiTime = calcPerfTime(singleApiStart);
                    failedApis++;
                    Logger.error({
                        msg: `${dirDisplayName}接口 ${apiPath} 加载失败，耗时: ${singleApiTime}`,
                        error: error.message,
                        stack: error.stack
                    });
                }
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`${dirDisplayName}接口加载完成! 总耗时: ${totalLoadTime}，总数: ${totalApis}, 成功: ${loadedApis}, 失败: ${failedApis}`);
        } catch (error: any) {
            Logger.error({
                msg: '加载接口时发生错误',
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 启动服务器
     */
    async listen(callback?: (server: Server) => void): Promise<void> {
        const serverStartTime = Bun.nanoseconds();
        Logger.info('开始启动 Befly 服务器...');

        await this.initCheck();
        await this.loadPlugins();
        await this.loadApis('core');
        await this.loadApis('app');

        const totalStartupTime = calcPerfTime(serverStartTime);
        Logger.info(`服务器启动准备完成，总耗时: ${totalStartupTime}`);

        const server = Bun.serve({
            port: Env.APP_PORT,
            hostname: Env.APP_HOST,
            routes: {
                '/': async (req) => {
                    const corsOptions = setCorsOptions(req);
                    return Response.json(
                        {
                            code: 0,
                            msg: 'Befly 接口服务已启动',
                            data: {
                                mode: Env.NODE_ENV
                            }
                        },
                        {
                            headers: corsOptions.headers
                        }
                    );
                },
                '/api/*': async (req) => {
                    try {
                        const corsOptions = setCorsOptions(req);

                        // 直接返回options请求
                        if (req.method === 'OPTIONS') {
                            return new Response(null, {
                                status: 204,
                                headers: corsOptions.headers
                            });
                        }

                        // 初始化请求数据存储
                        const ctx = {
                            headers: Object.fromEntries(req.headers.entries()),
                            body: {},
                            user: {}
                        };

                        // 接口处理
                        const url = new URL(req.url);
                        const apiPath = `${req.method}${url.pathname}`;

                        const api = this.apiRoutes.get(apiPath);

                        // 接口不存在
                        if (!api) {
                            return Response.json(No('接口不存在'), {
                                headers: corsOptions.headers
                            });
                        }

                        // 用户认证
                        const authHeader = req.headers.get('authorization');
                        if (authHeader && authHeader.startsWith('Bearer ')) {
                            const token = authHeader.substring(7);

                            try {
                                const payload = await Jwt.verify(token);
                                ctx.user = payload;
                            } catch (error: any) {
                                ctx.user = {};
                            }
                        } else {
                            ctx.user = {};
                        }

                        // GET请求
                        if (req.method === 'GET') {
                            if (isEmptyObject(api.fields) === false) {
                                ctx.body = pickFields(Object.fromEntries(url.searchParams), Object.keys(api.fields));
                            } else {
                                ctx.body = Object.fromEntries(url.searchParams);
                            }
                        }

                        // POST请求
                        if (req.method === 'POST') {
                            try {
                                const contentType = req.headers.get('content-type') || '';

                                if (contentType.indexOf('json') !== -1) {
                                    ctx.body = await req.json();
                                } else if (contentType.indexOf('xml') !== -1) {
                                    const textData = await req.text();
                                    const xmlData = Xml.parse(textData);
                                    ctx.body = xmlData?.xml ? xmlData.xml : xmlData;
                                } else if (contentType.indexOf('form-data') !== -1) {
                                    ctx.body = await req.formData();
                                } else if (contentType.indexOf('x-www-form-urlencoded') !== -1) {
                                    const text = await req.text();
                                    const formData = new URLSearchParams(text);
                                    ctx.body = Object.fromEntries(formData);
                                } else {
                                    ctx.body = {};
                                }
                                if (isEmptyObject(api.fields) === false) {
                                    ctx.body = pickFields(ctx.body, Object.keys(api.fields));
                                }
                            } catch (err) {
                                Logger.error({
                                    msg: '处理请求参数时发生错误',
                                    error: err.message,
                                    stack: err.stack
                                });

                                return Response.json(No('无效的请求参数格式'), {
                                    headers: corsOptions.headers
                                });
                            }
                        }

                        // 插件钩子
                        for await (const plugin of this.pluginLists) {
                            try {
                                if (typeof plugin?.onGet === 'function') {
                                    await plugin?.onGet(this.appContext, ctx, req);
                                }
                            } catch (error: any) {
                                Logger.error({
                                    msg: '插件处理请求时发生错误',
                                    error: error.message,
                                    stack: error.stack
                                });
                            }
                        }

                        // 请求记录
                        Logger.info({
                            msg: '通用接口日志',
                            请求路径: apiPath,
                            请求方法: req.method,
                            用户信息: ctx.user,
                            请求体: filterLogFields(ctx.body, Env.LOG_EXCLUDE_FIELDS)
                        });

                        // 登录验证 auth 有3种值 分别为 true、false、['admin', 'user']
                        if (api.auth === true && !ctx.user.id) {
                            return Response.json(No('未登录', {}, { login: 'no' }), {
                                headers: corsOptions.headers
                            });
                        }

                        // 如果为字符串，则判断是否等于角色类型
                        if (isType(api.auth, 'string') && api.auth !== ctx.user?.role_type) {
                            return Response.json(No('没有权限'), {
                                headers: corsOptions.headers
                            });
                        }

                        // 如果为数组，则判断角色是否在数组中
                        if (isType(api.auth, 'array') && !api.auth.includes(ctx.user?.role)) {
                            return Response.json(No('没有权限'), {
                                headers: corsOptions.headers
                            });
                        }

                        // 参数验证
                        const validate = validator.validate(ctx.body, api.fields, api.required);
                        if (validate.code !== 0) {
                            return Response.json(No('无效的请求参数格式', validate.fields), {
                                headers: corsOptions.headers
                            });
                        }

                        // 执行函数
                        const result = await api.handler(this.appContext, ctx, req);

                        // 返回数据
                        if (result && typeof result === 'object' && 'code' in result) {
                            return Response.json(result, {
                                headers: corsOptions.headers
                            });
                        } else {
                            return new Response(result, {
                                headers: corsOptions.headers
                            });
                        }
                    } catch (error: any) {
                        Logger.error({
                            msg: '处理接口请求时发生错误',
                            error: error.message,
                            stack: error.stack,
                            url: req.url
                        });
                        return Response.json(No('内部服务器错误'), {
                            headers: corsOptions.headers
                        });
                    }
                },
                '/*': async (req) => {
                    const corsOptions = setCorsOptions(req);

                    // 直接返回options请求
                    if (req.method === 'OPTIONS') {
                        return new Response(null, {
                            status: 204,
                            headers: corsOptions.headers
                        });
                    }

                    const url = new URL(req.url);
                    const filePath = path.join(getProjectDir('public'), url.pathname);

                    try {
                        const file = await Bun.file(filePath);
                        if (await file.exists()) {
                            return new Response(file, {
                                headers: {
                                    'Content-Type': file.type || 'application/octet-stream',
                                    ...corsOptions.headers
                                }
                            });
                        } else {
                            return Response.json(No('文件未找到'), {
                                headers: corsOptions.headers
                            });
                        }
                    } catch (error: any) {
                        return Response.json(No('文件读取失败'), {
                            headers: corsOptions.headers
                        });
                    }
                },
                ...(this.appOptions.routes || {})
            },
            error(error) {
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
    }
}

// 核心类已通过 export class 导出
export { Env, Api, Jwt, Validator, Crypto, Crypto2, Logger, Yes, No, SyncDb };
