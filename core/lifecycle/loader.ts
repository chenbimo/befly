/**
 * 插件和API加载器
 * 负责加载和初始化插件以及API路由
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { calcPerfTime, sortPlugins, isType } from '../utils/index.js';
import { __dirplugins, __dirapis, getProjectDir } from '../system.js';
import type { Plugin } from '../types/plugin.js';
import type { ApiRoute } from '../types/api.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 加载器类
 */
export class Loader {
    /**
     * 加载所有插件
     * @param befly - Befly实例（需要访问 pluginLists 和 appContext）
     */
    static async loadPlugins(befly: { pluginLists: Plugin[]; appContext: BeflyContext }): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();

            const glob = new Bun.Glob('*.{js,ts}');
            const corePlugins: Plugin[] = [];
            const userPlugins: Plugin[] = [];
            const loadedPluginNames = new Set<string>(); // 用于跟踪已加载的插件名称
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

            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                Logger.error(`插件依赖关系错误，请检查插件的 after 属性`);
                process.exit();
            }

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedCorePlugins) {
                try {
                    befly.pluginLists.push(plugin);
                    befly.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(befly.appContext) : {};
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
                        befly.pluginLists.push(plugin);
                        befly.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(befly.appContext) : {};
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

    /**
     * 加载API路由
     * @param dirName - 目录名称 ('core' 或 'app')
     * @param apiRoutes - API路由映射表
     */
    static async loadApis(dirName: string, apiRoutes: Map<string, ApiRoute>): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const dirDisplayName = dirName === 'core' ? '核心' : '用户';

            const glob = new Bun.Glob('**/*.{js,ts}');
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
                const apiPath = path
                    .relative(apiDir, file)
                    .replace(/\.(js|ts)$/, '')
                    .replace(/\\/g, '/');
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
                    if (api.required.some((item: any) => isType(item, 'string') === false)) {
                        throw new Error(`接口 ${apiPath} 的 required 属性必须是字符串数组`);
                    }
                    if (isType(api.handler, 'function') === false) {
                        throw new Error(`接口 ${apiPath} 的 handler 属性必须是函数`);
                    }
                    api.route = `${api.method.toUpperCase()}/api/${dirName}/${apiPath}`;
                    apiRoutes.set(api.route, api);

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
}
