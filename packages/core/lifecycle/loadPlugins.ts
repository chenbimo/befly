/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、用户）
 */

import { basename } from 'pathe';
import { existsSync } from 'node:fs';
import { camelCase } from 'es-toolkit/string';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { corePluginDir, projectPluginDir } from '../paths.js';
import { Addon } from '../lib/addon.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 排序插件（根据依赖关系）
 */
function sortPlugins(plugins: Plugin[]): Plugin[] | false {
    const result: Plugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pluginMap: Record<string, Plugin> = Object.fromEntries(plugins.map((p) => [p.pluginName || p.name, p]));
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
        (plugin.after || []).forEach(visit);
        visiting.delete(name);
        visited.add(name);
        result.push(plugin);
    };

    plugins.forEach((p) => visit(p.pluginName || p.name));
    return isPass ? result : false;
}

/**
 * 扫描核心插件
 */
async function scanCorePlugins(loadedPluginNames: Set<string>): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const glob = new Bun.Glob('*.ts');

    for await (const file of glob.scan({
        cwd: corePluginDir,
        onlyFiles: true,
        absolute: true
    })) {
        const fileName = basename(file).replace(/\.ts$/, '');
        if (fileName.startsWith('_')) continue;

        try {
            const pluginImport = await import(file);
            const plugin = pluginImport.default;
            plugin.pluginName = fileName;
            plugins.push(plugin);
            loadedPluginNames.add(fileName);
        } catch (err: any) {
            Logger.error(`核心插件 ${fileName} 导入失败`, err);
            process.exit(1);
        }
    }

    return plugins;
}

/**
 * 扫描组件插件
 */
async function scanAddonPlugins(loadedPluginNames: Set<string>): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const glob = new Bun.Glob('*.ts');
    const addons = Addon.scan();

    for (const addon of addons) {
        if (!Addon.dirExists(addon, 'plugins')) continue;

        const addonPluginsDir = Addon.getDir(addon, 'plugins');
        for await (const file of glob.scan({
            cwd: addonPluginsDir,
            onlyFiles: true,
            absolute: true
        })) {
            const fileName = basename(file).replace(/\.ts$/, '');
            if (fileName.startsWith('_')) continue;

            const addonCamelCase = camelCase(addon);
            const fileNameCamelCase = camelCase(fileName);
            const pluginFullName = `addon${addonCamelCase.charAt(0).toUpperCase() + addonCamelCase.slice(1)}_${fileNameCamelCase}`;

            if (loadedPluginNames.has(pluginFullName)) {
                continue;
            }

            try {
                const plugin = require(file);
                const pluginInstance = plugin.default;
                pluginInstance.pluginName = pluginFullName;
                plugins.push(pluginInstance);
                loadedPluginNames.add(pluginFullName);
            } catch (err: any) {
                Logger.error(`组件${addon} ${fileName} 导入失败`, err);
                process.exit(1);
            }
        }
    }

    return plugins;
}

/**
 * 扫描用户插件
 */
async function scanUserPlugins(loadedPluginNames: Set<string>): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    if (!existsSync(projectPluginDir)) {
        return plugins;
    }

    const glob = new Bun.Glob('*.ts');
    for await (const file of glob.scan({
        cwd: projectPluginDir,
        onlyFiles: true,
        absolute: true
    })) {
        const fileName = basename(file).replace(/\.ts$/, '');
        if (fileName.startsWith('_')) continue;

        const fileNameCamelCase = camelCase(fileName);
        const pluginFullName = `app${fileNameCamelCase.charAt(0).toUpperCase() + fileNameCamelCase.slice(1)}`;

        if (loadedPluginNames.has(pluginFullName)) {
            continue;
        }

        try {
            const plugin = require(file);
            const pluginInstance = plugin.default;
            pluginInstance.pluginName = pluginFullName;
            plugins.push(pluginInstance);
            loadedPluginNames.add(pluginFullName);
        } catch (err: any) {
            Logger.error(`用户插件 ${fileName} 导入失败`, err);
            process.exit(1);
        }
    }

    return plugins;
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
 * 加载所有插件
 * @param befly - Befly实例（需要访问 pluginLists 和 appContext）
 */
export async function loadPlugins(befly: { pluginLists: Plugin[]; appContext: BeflyContext }): Promise<void> {
    try {
        const loadStartTime = Bun.nanoseconds();
        const loadedPluginNames = new Set<string>();

        // 阶段1：扫描所有插件
        const corePlugins = await scanCorePlugins(loadedPluginNames);
        const addonPlugins = await scanAddonPlugins(loadedPluginNames);
        const userPlugins = await scanUserPlugins(loadedPluginNames);

        // 阶段2：分层排序插件
        const sortedCorePlugins = sortPlugins(corePlugins);
        if (sortedCorePlugins === false) {
            Logger.error('核心插件依赖关系错误，请检查插件的 after 属性');
            process.exit(1);
        }

        const sortedAddonPlugins = sortPlugins(addonPlugins);
        if (sortedAddonPlugins === false) {
            Logger.error('组件插件依赖关系错误，请检查插件的 after 属性');
            process.exit(1);
        }

        const sortedUserPlugins = sortPlugins(userPlugins);
        if (sortedUserPlugins === false) {
            Logger.error('用户插件依赖关系错误，请检查插件的 after 属性');
            process.exit(1);
        }

        // 阶段3：分层初始化插件（核心 → 组件 → 用户）
        // 3.1 初始化核心插件
        for (const plugin of sortedCorePlugins) {
            try {
                await initPlugin(befly, plugin);
            } catch (error: any) {
                Logger.error(`核心插件 ${plugin.pluginName} 初始化失败`, error);
                process.exit(1);
            }
        }

        // 3.2 初始化组件插件
        for (const plugin of sortedAddonPlugins) {
            try {
                await initPlugin(befly, plugin);
            } catch (error: any) {
                Logger.error(`组件插件 ${plugin.pluginName} 初始化失败`, error);
                process.exit(1);
            }
        }

        // 3.3 初始化用户插件
        for (const plugin of sortedUserPlugins) {
            try {
                await initPlugin(befly, plugin);
            } catch (error: any) {
                Logger.error(`用户插件 ${plugin.pluginName} 初始化失败`, error);
                process.exit(1);
            }
        }

        const totalLoadTime = calcPerfTime(loadStartTime);
    } catch (error: any) {
        Logger.error('加载插件时发生错误', error);
        process.exit(1);
    }
}
