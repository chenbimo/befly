/**
 * 插件和API加载器
 * 负责加载和初始化插件以及API路由
 */

import { relative, basename } from 'pathe';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { paths } from '../paths.js';
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
                cwd: paths.rootPluginDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = basename(file).replace(/\.ts$/, '');
                if (fileName.startsWith('_')) continue;

                try {
                    const importStart = Bun.nanoseconds();
                    Logger.debug(`准备导入核心插件: ${fileName}`);
                    const plugin = await importWithTimeout(file);
                    const importTime = calcPerfTime(importStart);
                    Logger.debug(`核心插件 ${fileName} 导入成功，耗时: ${importTime}`);

                    const pluginInstance = plugin.default;
                    pluginInstance.pluginName = fileName;
                    corePlugins.push(pluginInstance);
                    loadedPluginNames.add(fileName); // 记录已加载的核心插件名称

                    Logger.info(`核心插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err: any) {
                    hadCorePluginError = true;
                    Logger.error(`核心插件 ${fileName} 导入失败`, error);
                    process.exit(1);
                }
            }
            const corePluginsScanTime = calcPerfTime(corePluginsScanStart);
            Logger.info(`核心插件扫描完成，耗时: ${corePluginsScanTime}，共找到 ${corePlugins.length} 个插件`);

            Logger.debug(`调试模式已开启`);
            Logger.debug(`开始排序核心插件，插件列表: ${corePlugins.map((p) => p.pluginName).join(', ')}`);

            const sortedCorePlugins = sortPlugins(corePlugins);
            if (sortedCorePlugins === false) {
                Logger.warn('核心插件依赖关系错误，请检查插件的 after 属性');
                process.exit(1);
            }

            Logger.debug(`核心插件排序完成，顺序: ${sortedCorePlugins.map((p) => p.pluginName).join(' -> ')}`);

            // 初始化核心插件
            const corePluginsInitStart = Bun.nanoseconds();
            Logger.info(`开始初始化核心插件...`);
            for (const plugin of sortedCorePlugins) {
                try {
                    Logger.debug(`准备初始化核心插件: ${plugin.pluginName}`);

                    befly.pluginLists.push(plugin);

                    Logger.debug(`检查插件 ${plugin.pluginName} 是否有 onInit 方法: ${typeof plugin?.onInit === 'function'}`);

                    if (typeof plugin?.onInit === 'function') {
                        Logger.debug(`开始执行插件 ${plugin.pluginName} 的 onInit 方法`);

                        const pluginInitStart = Bun.nanoseconds();
                        befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                        const pluginInitTime = calcPerfTime(pluginInitStart);

                        Logger.debug(`插件 ${plugin.pluginName} 初始化完成，耗时: ${pluginInitTime}`);
                    } else {
                        befly.appContext[plugin.pluginName] = {};
                        Logger.debug(`插件 ${plugin.pluginName} 没有 onInit 方法，跳过初始化`);
                    }

                    Logger.info(`核心插件 ${plugin.pluginName} 初始化成功`);
                } catch (error: any) {
                    hadCorePluginError = true;
                    Logger.error(`核心插件 ${plugin.pluginName} 初始化失败`, error);

                    process.exit(1);
                }
            }
            const corePluginsInitTime = calcPerfTime(corePluginsInitStart);
            Logger.info(`核心插件初始化完成，耗时: ${corePluginsInitTime}`);

            // 扫描 addon 插件目录
            const addons = scanAddons();
            if (addons.length > 0) {
                const addonPluginsScanStart = Bun.nanoseconds();
                for (const addon of addons) {
                    if (!addonDirExists(addon, 'plugins')) continue;

                    const addonPluginsDir = getAddonDir(addon, 'plugins');
                    for await (const file of glob.scan({
                        cwd: addonDir,
                        onlyFiles: true,
                        absolute: true
                    })) {
                        const fileName = basename(file).replace(/\.ts$/, '');
                        if (fileName.startsWith('_')) continue;

                        const pluginFullName = `${addon}.${fileName}`;

                        // 检查是否已经加载了同名插件
                        if (loadedPluginNames.has(pluginFullName)) {
                            Logger.info(`跳过组件插件 ${pluginFullName}，因为同名插件已存在`);
                            continue;
                        }

                        try {
                            const importStart = Bun.nanoseconds();
                            Logger.debug(`准备导入 addon 插件: ${addon}.${fileName}`);
                            const plugin = await importWithTimeout(file);
                            const importTime = calcPerfTime(importStart);
                            Logger.debug(`Addon 插件 ${addon}.${fileName} 导入成功，耗时: ${importTime}`);

                            const pluginInstance = plugin.default;
                            pluginInstance.pluginName = pluginFullName;
                            addonPlugins.push(pluginInstance);
                            loadedPluginNames.add(pluginFullName);

                            Logger.info(`组件${addon} ${fileName} 导入耗时: ${importTime}`);
                        } catch (err: any) {
                            hadAddonPluginError = true;
                            Logger.error(`组件${addon} ${fileName} 导入失败`, error);
                            process.exit(1);
                        }
                    }
                }
                const addonPluginsScanTime = calcPerfTime(addonPluginsScanStart);
                Logger.info(`组件插件扫描完成，耗时: ${addonPluginsScanTime}，共找到 ${addonPlugins.length} 个插件`);

                const sortedAddonPlugins = sortPlugins(addonPlugins);
                if (sortedAddonPlugins === false) {
                    Logger.warn({
                        level: 'WARNING',
                        msg: '组件插件依赖关系错误，请检查插件的 after 属性'
                    });
                } else {
                    // 初始化组件插件
                    const addonPluginsInitStart = Bun.nanoseconds();
                    Logger.info(`开始初始化组件插件...`);
                    for (const plugin of sortedAddonPlugins) {
                        try {
                            Logger.debug(`准备初始化组件插件: ${plugin.pluginName}`);

                            befly.pluginLists.push(plugin);

                            if (typeof plugin?.onInit === 'function') {
                                Logger.debug(`开始执行组件插件 ${plugin.pluginName} 的 onInit 方法`);

                                const pluginInitStart = Bun.nanoseconds();
                                befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                                const pluginInitTime = calcPerfTime(pluginInitStart);

                                Logger.debug(`组件插件 ${plugin.pluginName} 初始化完成，耗时: ${pluginInitTime}`);
                            } else {
                                befly.appContext[plugin.pluginName] = {};
                            }

                            Logger.info(`组件插件 ${plugin.pluginName} 初始化成功`);
                        } catch (error: any) {
                            hadAddonPluginError = true;
                            Logger.error(`组件插件 ${plugin.pluginName} 初始化失败`, error);
                        }
                    }
                    const addonPluginsInitTime = calcPerfTime(addonPluginsInitStart);
                    Logger.info(`组件插件初始化完成，耗时: ${addonPluginsInitTime}`);
                }
            }

            // 扫描用户插件目录
            const userPluginsScanStart = Bun.nanoseconds();
            for await (const file of glob.scan({
                cwd: userPluginDir,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = basename(file).replace(/\.ts$/, '');
                if (fileName.startsWith('_')) continue;

                // 检查是否已经加载了同名的核心插件
                if (loadedPluginNames.has(fileName)) {
                    Logger.info(`跳过用户插件 ${fileName}，因为同名的核心插件已存在`);
                    continue;
                }

                try {
                    const importStart = Bun.nanoseconds();
                    Logger.debug(`准备导入用户插件: ${fileName}`);
                    const plugin = await importWithTimeout(file);
                    const importTime = calcPerfTime(importStart);
                    Logger.debug(`用户插件 ${fileName} 导入成功，耗时: ${importTime}`);

                    const pluginInstance = plugin.default;
                    pluginInstance.pluginName = fileName;
                    userPlugins.push(pluginInstance);

                    Logger.info(`用户插件 ${fileName} 导入耗时: ${importTime}`);
                } catch (err: any) {
                    hadUserPluginError = true;
                    Logger.error(`用户插件 ${fileName} 导入失败`, error);
                    process.exit(1);
                }
            }
            const userPluginsScanTime = calcPerfTime(userPluginsScanStart);
            Logger.info(`用户插件扫描完成，耗时: ${userPluginsScanTime}，共找到 ${userPlugins.length} 个插件`);

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
                Logger.info(`开始初始化用户插件...`);
                for (const plugin of sortedUserPlugins) {
                    try {
                        Logger.debug(`准备初始化用户插件: ${plugin.pluginName}`);

                        befly.pluginLists.push(plugin);

                        if (typeof plugin?.onInit === 'function') {
                            Logger.debug(`开始执行用户插件 ${plugin.pluginName} 的 onInit 方法`);

                            const pluginInitStart = Bun.nanoseconds();
                            befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
                            const pluginInitTime = calcPerfTime(pluginInitStart);

                            Logger.debug(`用户插件 ${plugin.pluginName} 初始化完成，耗时: ${pluginInitTime}`);
                        } else {
                            befly.appContext[plugin.pluginName] = {};
                        }

                        Logger.info(`用户插件 ${plugin.pluginName} 初始化成功`);
                    } catch (error: any) {
                        hadUserPluginError = true;
                        Logger.error(`用户插件 ${plugin.pluginName} 初始化失败`, error);
                    }
                }
                const userPluginsInitTime = calcPerfTime(userPluginsInitStart);
                Logger.info(`用户插件初始化完成，耗时: ${userPluginsInitTime}`);
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            const totalPluginCount = sortedCorePlugins.length + addonPlugins.length + sortedUserPlugins.length;
            Logger.info(`插件加载完成! 总耗时: ${totalLoadTime}，共加载 ${totalPluginCount} 个插件`);

            // 核心插件失败 → 关键错误，必须退出
            if (hadCorePluginError) {
                Logger.warn('核心插件加载失败，无法继续启动', {
                    corePluginCount: sortedCorePlugins.length,
                    totalPluginCount
                });
                process.exit(1);
            }

            // Addon 插件失败 → 警告，可以继续运行
            if (hadAddonPluginError) {
                Logger.info({
                    level: 'INFO',
                    msg: '部分 Addon 插件加载失败，但不影响核心功能',
                    addonPluginCount: addonPlugins.length
                });
            }

            // 用户插件失败 → 警告，可以继续运行
            if (hadUserPluginError) {
                Logger.info({
                    level: 'INFO',
                    msg: '部分用户插件加载失败，但不影响核心功能',
                    userPluginCount: sortedUserPlugins.length
                });
            }
        } catch (error: any) {
            Logger.error('加载插件时发生错误', error);
            process.exit(1);
        }
    }

    /**
     * 加载API路由
     * @param dirName - 目录名称 ('app' | addon名称)
     * @param apiRoutes - API路由映射表
     * @param options - 可选配置（用于 addon）
     */
    static async loadApis(dirName: string, apiRoutes: Map<string, ApiRoute>, options?: { isAddon?: boolean; addonName?: string }): Promise<void> {
        try {
            const loadStartTime = Bun.nanoseconds();
            const isAddon = options?.isAddon || false;
            const addonName = options?.addonName || '';
            const dirDisplayName = isAddon ? `组件${addonName}` : '用户';

            const glob = new Bun.Glob('**/*.ts');
            const apiDir = isAddon ? getAddonDir(addonName, 'apis') : paths.projectApiDir;

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
                    Logger.debug(`[${dirDisplayName}] 准备导入 API 文件: ${apiPath}`);
                    Logger.debug(`[${dirDisplayName}] 文件绝对路径: ${file}`);

                    const importStart = Bun.nanoseconds();
                    const api = (await importWithTimeout(file)).default;
                    const importTime = calcPerfTime(importStart);

                    Logger.debug(`[${dirDisplayName}] API 文件导入成功: ${apiPath}，耗时: ${importTime}`);

                    Logger.debug(`[${dirDisplayName}] 开始验证 API 属性: ${apiPath}`);

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

                    Logger.debug(`[${dirDisplayName}] API 属性验证通过: ${apiPath}`);

                    // 构建路由：addon 接口添加前缀 /api/addon/{addonName}/{apiPath}，项目接口为 /api/{apiPath}
                    if (isAddon) {
                        api.route = `${api.method.toUpperCase()}/api/addon/${addonName}/${apiPath}`;
                    } else {
                        api.route = `${api.method.toUpperCase()}/api/${apiPath}`;
                    }
                    apiRoutes.set(api.route, api);

                    const singleApiTime = calcPerfTime(singleApiStart);
                    loadedApis++;
                    Logger.debug(`[${dirDisplayName}] API 注册成功 - 名称: ${api.name}, 路由: ${api.route}, 耗时: ${singleApiTime}`);
                } catch (error: any) {
                    const singleApiTime = calcPerfTime(singleApiStart);
                    failedApis++;

                    const errorMessage = error?.message || '未知错误';

                    // 记录详细错误信息
                    Logger.error(`[${dirDisplayName}] 接口 ${apiPath} 加载失败 (${singleApiTime})`, error);

                    process.exit(1);
                }
            }

            const totalLoadTime = calcPerfTime(loadStartTime);
            Logger.info(`${dirDisplayName}接口加载完成! 总耗时: ${totalLoadTime}，总数: ${totalApis}, 成功: ${loadedApis}, 失败: ${failedApis}`);

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
            Logger.error(`加载${dirDisplayName}接口时发生错误`, error);
            process.exit(1);
        }
    }
}
