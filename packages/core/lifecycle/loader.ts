/**
 * 插件和API加载器
 * 负责加载和初始化插件以及API路由
 */

import { relative, basename } from 'pathe';
import { existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { corePluginDir, projectPluginDir, coreApiDir, projectApiDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';
import type { Plugin } from '../types/plugin.js';
import type { ApiRoute } from '../types/api.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * API 默认字段定义
 * 这些字段会自动合并到所有 API 的 fields 中
 * API 自定义的同名字段可以覆盖这些默认值
 */
const DEFAULT_API_FIELDS = {
    id: 'ID|number|1|null|null|0|null',
    page: '页码|number|1|9999|1|0|null',
    limit: '每页数量|number|1|100|10|0|null',
    keyword: '关键词|string|1|50|null|0|null',
    state: '状态|number|0|2|1|1|null'
} as const;

/**
 * 排序插件（根据依赖关系）
 */
export const sortPlugins = (plugins: Plugin[]): Plugin[] | false => {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.name, p]));
    let isPass = true;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return;

        visiting.add(name);
        (plugin.dependencies || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.name));
    return isPass ? result : false;
};

/**
 * 带超时的动态导入函数
 * @param filePath - 文件路径
 * @param timeout - 超时时间（毫秒），默认 3000ms
 * @returns 导入的模块
 */
async function importWithTimeout(filePath: string, timeout: number = 3000): Promise<any> {
    return Promise.race([
        import(filePath),
        new Promise((_, reject) =>
            setTimeout(() => {
                reject(new Error(`模块导入超时 (${timeout}ms)，可能存在死循环或模块依赖问题`));
            }, timeout)
        )
    ]);
}

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
            const addonPlugins: Plugin[] = [];
            const userPlugins: Plugin[] = [];
            const loadedPluginNames = new Set<string>(); // 用于跟踪已加载的插件名称
            let hadCorePluginError = false; // 核心插件错误（关键）
            let hadAddonPluginError = false; // Addon 插件错误（警告）
            let hadUserPluginError = false; // 用户插件错误（警告）

            // 扫描核心插件目录
            const corePluginsScanStart = Bun.nanoseconds();
            for await (const file of glob.scan({
                cwd: corePluginDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = basename(file).replace(/\.ts$/, '');
                if (fileName.startsWith('_')) continue;

                try {
                    const plugin = await importWithTimeout(file);
                    const pluginInstance = plugin.default;
                    pluginInstance.pluginName = fileName;
                    corePlugins.push(pluginInstance);
                    loadedPluginNames.add(fileName); // 记录已加载的核心插件名称
                } catch (err: any) {
                    hadCorePluginError = true;
                    Logger.error(`核心插件 ${fileName} 导入失败`, error);
                    process.exit(1);
                }
            }
            const corePluginsScanTime = calcPerfTime(corePluginsScanStart);

            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                Logger.warn('核心插件依赖关系错误，请检查插件的 after 属性');
                process.exit(1);
            }

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            for (const plugin of sortedCorePlugins) {
                try {
                    befly.pluginLists.push(plugin);
                    if (typeof plugin?.onInit === 'function') {
                        const pluginInitStart = Bun.nanoseconds();
                        befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                        const pluginInitTime = calcPerfTime(pluginInitStart);
                    } else {
                        befly.appContext[plugin.pluginName] = {};
                    }
                } catch (error: any) {
                    hadCorePluginError = true;
                    Logger.error(`核心插件 ${plugin.pluginName} 初始化失败`, error);
                    process.exit(1);
                }
            }
            const corePluginsInitTime = calcPerfTime(corePluginsInitStart);
            Logger.info(`✓ 核心插件加载完成: ${corePlugins.length} 个，耗时: ${corePluginsScanTime}`);

            // 扫描 addon 插件目录
            const addons = scanAddons();
            if (addons.length > 0) {
                const addonPluginsScanStart = Bun.nanoseconds();
                for (const addon of addons) {
                    if (!addonDirExists(addon, 'plugins')) continue;

                    const addonPluginsDir = getAddonDir(addon, 'plugins');
                    for await (const file of glob.scan({
                        cwd: addonPluginsDir,
                        onlyFiles: true,
                        absolute: true
                    })) {
                        const fileName = basename(file).replace(/\.ts$/, '');
                        if (fileName.startsWith('_')) continue;

                        const pluginFullName = `${addon}.${fileName}`;

                        // 检查是否已经加载了同名插件
                        if (loadedPluginNames.has(pluginFullName)) {                            continue;
                        }

                        try {
                            const importStart = Bun.nanoseconds();                            const plugin = await importWithTimeout(file);
                            const importTime = calcPerfTime(importStart);
                            const pluginInstance = plugin.default;
                            pluginInstance.pluginName = pluginFullName;
                            addonPlugins.push(pluginInstance);
                            loadedPluginNames.add(pluginFullName);                        } catch (err: any) {
                            hadAddonPluginError = true;
                            Logger.error(`组件${addon} ${fileName} 导入失败`, error);
                            process.exit(1);
                        }
                    }
                }
                const addonPluginsScanTime = calcPerfTime(addonPluginsScanStart);

                const sortedAddonPlugins = sortPlugins(addonPlugins);
                if (sortedAddonPlugins === false) {
                    Logger.warn({
                        level: 'WARNING',
                        msg: '组件插件依赖关系错误，请检查插件的 after 属性'
                    });
                } else {
                    // 初始化组件插件
                    const addonPluginsInitStart = Bun.nanoseconds();
                    for (const plugin of sortedAddonPlugins) {
                        try {
                            befly.pluginLists.push(plugin);

                            if (typeof plugin?.onInit === 'function') {
                                const pluginInitStart = Bun.nanoseconds();
                                befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                                const pluginInitTime = calcPerfTime(pluginInitStart);
                            } else {
                                befly.appContext[plugin.pluginName] = {};
                            }
                        } catch (error: any) {
                            hadAddonPluginError = true;
                            Logger.error(`组件插件 ${plugin.pluginName} 初始化失败`, error);
                        }
                    }
                    const addonPluginsInitTime = calcPerfTime(addonPluginsInitStart);
                    Logger.info(`✓ 组件插件加载完成: ${addonPlugins.length} 个，耗时: ${addonPluginsScanTime}`);
                }
            }

            // 扫描用户插件目录
            if (!existsSync(projectPluginDir)) {
                // 项目插件目录不存在，跳过
            } else {
                const userPluginsScanStart = Bun.nanoseconds();
                for await (const file of glob.scan({
                    cwd: projectPluginDir,
                    onlyFiles: true,
                    absolute: true
                })) {
                    const fileName = basename(file).replace(/\.ts$/, '');
                    if (fileName.startsWith('_')) continue;

                    // 检查是否已经加载了同名的核心插件
                    if (loadedPluginNames.has(fileName)) {                        continue;
                    }

                    try {
                        const plugin = await importWithTimeout(file);
                        const pluginInstance = plugin.default;
                        pluginInstance.pluginName = fileName;
                        userPlugins.push(pluginInstance);                    } catch (err: any) {
                        hadUserPluginError = true;
                        Logger.error(`用户插件 ${fileName} 导入失败`, error);
                        process.exit(1);
                    }
                }
            }

            const sortedUserPlugins = sortPlugins(userPlugins);
            if (sortedUserPlugins === false) {
                Logger.warn({
                    level: 'WARNING',
                    msg: '用户插件依赖关系错误，请检查插件的 after 属性'
                });
                // 用户插件错误不退出，只是跳过这些插件
                return;
            }

            // 初始化用户插件
            if (userPlugins.length > 0) {
                const userPluginsInitStart = Bun.nanoseconds();
                for (const plugin of sortedUserPlugins) {
                    try {
                        befly.pluginLists.push(plugin);

                        if (typeof plugin?.onInit === 'function') {
                            befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                        } else {
                            befly.appContext[plugin.pluginName] = {};
                        }
                    } catch (error: any) {
                        hadUserPluginError = true;
                        Logger.error(`用户插件 ${plugin.pluginName} 初始化失败`, error);
                    }
                }
                const userPluginsInitTime = calcPerfTime(userPluginsInitStart);
                Logger.info(`✓ 用户插件加载完成: ${sortedUserPlugins.length} 个，耗时: ${userPluginsInitTime}`);
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            const totalPluginCount = sortedCorePlugins.length + addonPlugins.length + sortedUserPlugins.length;
            Logger.info(`✓ 所有插件加载完成: ${totalPluginCount} 个，总耗时: ${totalLoadTime}`);

            // 核心插件失败 → 关键错误，必须退出
            if (hadCorePluginError) {
                Logger.warn('核心插件加载失败，无法继续启动');
                process.exit(1);
            }

            // Addon 插件失败 → 警告，可以继续运行
            if (hadAddonPluginError) {
                Logger.warn('部分 Addon 插件加载失败，但不影响核心功能');
            }

            // 用户插件失败 → 警告，可以继续运行
            if (hadUserPluginError) {
                Logger.warn('部分用户插件加载失败，但不影响核心功能');
            }
        } catch (error: any) {
            Logger.error('加载插件时发生错误', error);
            process.exit(1);
        }
    }

    /**
     * 加载API路由
     * @param dirName - 目录名称 ('core' | 'app' | addon名称)
     * @param apiRoutes - API路由映射表
     * @param options - 可选配置
     * @param options.where - API来源类型：'core' | 'addon' | 'app'
     * @param options.addonName - addon名称（仅当 where='addon' 时需要）
     */
    static async loadApis(dirName: string, apiRoutes: Map<string, ApiRoute>, options?: { where?: 'core' | 'addon' | 'app'; addonName?: string }): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const where = options?.where || 'app';
            const addonName = options?.addonName || '';
            const dirDisplayName = where === 'core' ? '核心' : where === 'addon' ? `组件${addonName}` : '用户';

            const glob = new Bun.Glob('**/*.ts');
            let apiDir: string;

            if (where === 'core') {
                apiDir = coreApiDir;
            } else if (where === 'addon') {
                apiDir = getAddonDir(addonName, 'apis');
            } else {
                apiDir = projectApiDir;
            }

            // 检查目录是否存在
            if (!existsSync(apiDir)) {                return;
            }

            let totalApis = 0;
            let loadedApis = 0;
            let failedApis = 0;

            // 扫描指定目录
            for await (const file of glob.scan({
                cwd: apiDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = basename(file).replace(/\.ts$/, '');
                const apiPath = relative(apiDir, file).replace(/\.ts$/, '');
                if (apiPath.indexOf('_') !== -1) continue;

                totalApis++;
                const singleApiStart = Bun.nanoseconds();

                try {
                    const importStart = Bun.nanoseconds();
                    const api = (await importWithTimeout(file)).default;
                    const importTime = calcPerfTime(importStart);
                    // 验证必填属性：name 和 handler
                    if (typeof api.name !== 'string' || api.name.trim() === '') {
                        throw new Error(`接口 ${apiPath} 的 name 属性必须是非空字符串`);
                    }
                    if (typeof api.handler !== 'function') {
                        throw new Error(`接口 ${apiPath} 的 handler 属性必须是函数`);
                    }

                    // 设置默认值
                    api.method = api.method || 'POST';
                    api.auth = api.auth !== undefined ? api.auth : true;

                    // 合并默认字段：先设置默认字段，再用 API 自定义字段覆盖
                    api.fields = { ...DEFAULT_API_FIELDS, ...(api.fields || {}) };
                    api.required = api.required || [];

                    // 验证可选属性的类型（如果提供了）
                    if (api.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method.toUpperCase())) {
                        throw new Error(`接口 ${apiPath} 的 method 属性必须是有效的 HTTP 方法`);
                    }
                    if (api.auth !== undefined && typeof api.auth !== 'boolean') {
                        throw new Error(`接口 ${apiPath} 的 auth 属性必须是布尔值 (true=需登录, false=公开)`);
                    }
                    if (api.fields && !isPlainObject(api.fields)) {
                        throw new Error(`接口 ${apiPath} 的 fields 属性必须是对象`);
                    }
                    if (api.required && !Array.isArray(api.required)) {
                        throw new Error(`接口 ${apiPath} 的 required 属性必须是数组`);
                    }
                    if (api.required && api.required.some((item: any) => typeof item !== 'string')) {
                        throw new Error(`接口 ${apiPath} 的 required 属性必须是字符串数组`);
                    }
                    // 构建路由：
                    // - core 接口: /api/core/{apiPath}
                    // - addon 接口: /api/addon/{addonName}/{apiPath}
                    // - 项目接口: /api/{apiPath}
                    if (where === 'core') {
                        api.route = `${api.method.toUpperCase()}/api/core/${apiPath}`;
                    } else if (where === 'addon') {
                        api.route = `${api.method.toUpperCase()}/api/addon/${addonName}/${apiPath}`;
                    } else {
                        api.route = `${api.method.toUpperCase()}/api/${apiPath}`;
                    }
                    apiRoutes.set(api.route, api);

                    loadedApis++;
                } catch (error: any) {
                    failedApis++;

                    // 记录详细错误信息
                    Logger.error(`[${dirDisplayName}] 接口 ${apiPath} 加载失败`, error);

                    process.exit(1);
                }
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`✓ ${dirDisplayName}接口加载完成: ${loadedApis}/${totalApis}，耗时: ${totalLoadTime}`);

            // 检查是否有加载失败的 API（理论上不会到达这里，因为上面已经 critical 退出）
            if (failedApis > 0) {
                Logger.warn(`有 ${failedApis} 个${dirDisplayName}接口加载失败，无法继续启动服务`, {
                    dirName,
                    totalApis,
                    failedApis
                });
                process.exit(1);
            }
        } catch (error: any) {
            Logger.error(`加载接口时发生错误`, error);
            process.exit(1);
        }
    }
}
