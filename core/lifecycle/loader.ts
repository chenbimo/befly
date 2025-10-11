/**
 * 插件和API加载器
 * 负责加载和初始化插件以及API路由
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/datetime.js';
import { sortPlugins } from '../utils/pluginHelper.js';
import { isType } from '../utils/typeHelper.js';
import { __dirplugins, __dirapis, getProjectDir } from '../system.js';
import { ErrorHandler } from '../utils/errorHandler.js';
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

            const glob = new Bun.Glob('*.ts');
            const corePlugins: Plugin[] = [];
            const userPlugins: Plugin[] = [];
            const loadedPluginNames = new Set<string>(); // 用于跟踪已加载的插件名称
            let hadCorePluginError = false; // 核心插件错误（关键）
            let hadUserPluginError = false; // 用户插件错误（警告）

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
                    hadCorePluginError = true;
                    ErrorHandler.warning(`核心插件 ${fileName} 导入失败`, err);
                }
            }
            const corePluginsScanTime = calcPerfTime(corePluginsScanStart);
            Logger.info(`核心插件扫描完成，耗时: ${corePluginsScanTime}，共找到 ${corePlugins.length} 个插件`);

            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                ErrorHandler.critical('核心插件依赖关系错误，请检查插件的 after 属性');
            }

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedCorePlugins) {
                try {
                    befly.pluginLists.push(plugin);
                    befly.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(befly.appContext) : {};
                } catch (error: any) {
                    hadCorePluginError = true;
                    ErrorHandler.warning(`核心插件 ${plugin.pluginName} 初始化失败`, error);
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
                    hadUserPluginError = true;
                    ErrorHandler.warning(`用户插件 ${fileName} 导入失败`, err);
                }
            }
            const userPluginsScanTime = calcPerfTime(userPluginsScanStart);
            Logger.info(`用户插件扫描完成，耗时: ${userPluginsScanTime}，共找到 ${userPlugins.length} 个插件`);

            const sortedUserPlugins = sortPlugins(userPlugins);
            if (sortedUserPlugins === false) {
                ErrorHandler.warning('用户插件依赖关系错误，请检查插件的 after 属性');
                // 用户插件错误不退出，只是跳过这些插件
                return;
            }

            // 初始化用户插件
            if (userPlugins.length > 0) {
                const userPluginsInitStart = Bun.nanoseconds();
                for (const plugin of sortedUserPlugins) {
                    try {
                        befly.pluginLists.push(plugin);
                        befly.appContext[plugin.pluginName] = typeof plugin?.onInit === 'function' ? await plugin?.onInit(befly.appContext) : {};
                    } catch (error: any) {
                        hadUserPluginError = true;
                        ErrorHandler.warning(`用户插件 ${plugin.pluginName} 初始化失败`, error);
                    }
                }
                const userPluginsInitTime = calcPerfTime(userPluginsInitStart);
                Logger.info(`用户插件初始化完成，耗时: ${userPluginsInitTime}`);
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            const totalPluginCount = sortedCorePlugins.length + sortedUserPlugins.length;
            Logger.info(`插件加载完成! 总耗时: ${totalLoadTime}，共加载 ${totalPluginCount} 个插件`);

            // 核心插件失败 → 关键错误，必须退出
            if (hadCorePluginError) {
                ErrorHandler.critical('核心插件加载失败，无法继续启动', undefined, {
                    corePluginCount: sortedCorePlugins.length,
                    totalPluginCount
                });
            }

            // 用户插件失败 → 警告，可以继续运行
            if (hadUserPluginError) {
                ErrorHandler.info('部分用户插件加载失败，但不影响核心功能', {
                    userPluginCount: sortedUserPlugins.length
                });
            }
        } catch (error: any) {
            ErrorHandler.critical('加载插件时发生错误', error);
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

            const glob = new Bun.Glob('**/*.ts');
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
                    ErrorHandler.warning(`${dirDisplayName}接口 ${apiPath} 加载失败，耗时: ${singleApiTime}`, error);
                }
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`${dirDisplayName}接口加载完成! 总耗时: ${totalLoadTime}，总数: ${totalApis}, 成功: ${loadedApis}, 失败: ${failedApis}`);

            // API 加载失败只是警告，不影响服务启动
            if (failedApis > 0) {
                ErrorHandler.info(`${failedApis} 个${dirDisplayName}接口加载失败`, {
                    dirName,
                    totalApis,
                    failedApis
                });
            }
        } catch (error: any) {
            ErrorHandler.critical(`加载${dirDisplayName}接口时发生错误`, error);
        }
    }
}
