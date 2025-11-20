/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、用户）
 */

import { basename } from 'pathe';
import { existsSync } from 'node:fs';
import { camelCase } from 'es-toolkit/string';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from 'befly-util';
import { scanFiles } from 'befly-util';
import { corePluginDir, projectPluginDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from 'befly-util';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 统一导入并注册插件
 */
async function importAndRegisterPlugins(files: Array<{ filePath: string; fileName: string }>, loadedPluginNames: Set<string>, nameGenerator: (fileName: string, filePath: string) => string, errorLabelGenerator: (fileName: string, filePath: string) => string, pluginsConfig?: Record<string, Record<string, any>>): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    for (const { filePath, fileName } of files) {
        const pluginName = nameGenerator(fileName, filePath);

        if (loadedPluginNames.has(pluginName)) {
            continue;
        }

        try {
            const normalizedFilePath = filePath.replace(/\\/g, '/');
            const pluginImport = await import(normalizedFilePath);
            const plugin = pluginImport.default;
            plugin.pluginName = pluginName;

            // 注入配置
            if (pluginsConfig && pluginsConfig[pluginName]) {
                plugin.config = pluginsConfig[pluginName];
            }

            plugins.push(plugin);
            loadedPluginNames.add(pluginName);
        } catch (err: any) {
            const label = errorLabelGenerator(fileName, filePath);
            Logger.error(`${label} 导入失败`, err);
            process.exit(1);
        }
    }

    return plugins;
}

/**
 * 排序插件（根据依赖关系）
 */
export function sortPlugins(plugins: Plugin[]): Plugin[] | false {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.pluginName, p]));
    let isPass = true;

    // 检查依赖是否存在
    for (const plugin of plugins) {
        if (plugin.after) {
            for (const dep of plugin.after) {
                if (!pluginMap[dep]) {
                    Logger.error(`插件 ${plugin.pluginName} 依赖的插件 ${dep} 未找到`);
                    isPass = false;
                }
            }
        }
    }

    if (!isPass) return false;

    const visit = (name: string): void => {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            Logger.error(`插件循环依赖: ${name}`);
            isPass = false;
            return;
        }

        const plugin = pluginMap[name];
        if (!plugin) return;

        visiting.add(name);
        (plugin.after || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.pluginName));
    return isPass ? result : false;
}

/**
 * 扫描核心插件
 */
async function scanCorePlugins(loadedPluginNames: Set<string>, pluginsConfig?: Record<string, Record<string, any>>): Promise<Plugin[]> {
    const files = await scanFiles(corePluginDir, '*.{ts,js}');
    return importAndRegisterPlugins(
        files,
        loadedPluginNames,
        (fileName) => camelCase(fileName),
        (fileName) => `核心插件 ${fileName}`,
        pluginsConfig
    );
}

/**
 * 扫描组件插件
 */
async function scanAddonPlugins(loadedPluginNames: Set<string>, pluginsConfig?: Record<string, Record<string, any>>): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const addons = scanAddons();

    for (const addon of addons) {
        if (!addonDirExists(addon, 'plugins')) continue;

        const addonPluginsDir = getAddonDir(addon, 'plugins');
        const files = await scanFiles(addonPluginsDir, '*.{ts,js}');

        const addonPlugins = await importAndRegisterPlugins(
            files,
            loadedPluginNames,
            (fileName) => {
                const addonNameCamel = camelCase(addon);
                const fileNameCamel = camelCase(fileName);
                return `addon_${addonNameCamel}_${fileNameCamel}`;
            },
            (fileName) => `组件${addon} ${fileName}`,
            pluginsConfig
        );
        plugins.push(...addonPlugins);
    }

    return plugins;
}

/**
 * 扫描用户插件
 */
async function scanUserPlugins(loadedPluginNames: Set<string>, pluginsConfig?: Record<string, Record<string, any>>): Promise<Plugin[]> {
    if (!existsSync(projectPluginDir)) {
        return [];
    }

    const files = await scanFiles(projectPluginDir, '*.{ts,js}');
    return importAndRegisterPlugins(
        files,
        loadedPluginNames,
        (fileName) => `app_${camelCase(fileName)}`,
        (fileName) => `用户插件 ${fileName}`,
        pluginsConfig
    );
}

/**
 * 初始化单个插件
 */
async function initPlugin(befly: { pluginLists: Plugin[]; appContext: BeflyContext }, plugin: Plugin): Promise<void> {
    befly.pluginLists.push(plugin);

    if (typeof plugin?.onInit === 'function') {
        befly.appContext[plugin.pluginName] = await plugin?.onInit(befly.appContext);
    } else {
        befly.appContext[plugin.pluginName] = {};
    }
}

/**
 * 处理插件组（排序与初始化）
 */
async function processPluginGroup(befly: { pluginLists: Plugin[]; appContext: BeflyContext }, plugins: Plugin[], groupName: string): Promise<void> {
    const sortedPlugins = sortPlugins(plugins);
    if (sortedPlugins === false) {
        Logger.error(`${groupName}依赖关系错误，请检查插件的 after 属性`);
        process.exit(1);
    }

    for (const plugin of sortedPlugins) {
        try {
            await initPlugin(befly, plugin);
        } catch (error: any) {
            Logger.error(`${groupName} ${plugin.pluginName} 初始化失败`, error);
            process.exit(1);
        }
    }
}

/**
 * 加载所有插件
 * @param befly - Befly实例（需要访问 pluginLists 和 appContext）
 */
export async function loadPlugins(befly: { pluginLists: Plugin[]; appContext: BeflyContext; pluginsConfig?: Record<string, Record<string, any>> }): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();
        const loadedPluginNames = new Set<string>();

        // 阶段1：扫描所有插件
        const corePlugins = await scanCorePlugins(loadedPluginNames, befly.pluginsConfig);
        const addonPlugins = await scanAddonPlugins(loadedPluginNames, befly.pluginsConfig);
        const userPlugins = await scanUserPlugins(loadedPluginNames, befly.pluginsConfig);

        // 阶段2 & 3：分层排序与初始化
        await processPluginGroup(befly, corePlugins, '核心插件');
        await processPluginGroup(befly, addonPlugins, '组件插件');
        await processPluginGroup(befly, userPlugins, '用户插件');

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载插件时发生错误', error);
        process.exit(1);
    }
}
