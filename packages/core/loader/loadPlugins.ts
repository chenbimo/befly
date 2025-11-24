/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import { scanAddons, getAddonDir } from 'befly-util';

import { Logger } from '../lib/logger.js';
import { corePluginDir, projectPluginDir } from '../paths.js';
import { sortModules, scanModules } from '../util.js';

import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

// ==================== 插件加载逻辑 ====================

async function initPlugin(befly: { pluginLists: Plugin[]; appContext: BeflyContext }, plugin: Plugin): Promise<void> {
    befly.pluginLists.push(plugin);

    if (typeof plugin.handler === 'function') {
        befly.appContext[plugin.name!] = await plugin.handler(befly.appContext);
    } else {
        befly.appContext[plugin.name!] = {};
    }
}

export async function loadPlugins(befly: {
    //
    pluginLists: Plugin[];
    appContext: BeflyContext;
    pluginsConfig?: Record<string, any>;
}): Promise<void> {
    try {
        const loadedNames = new Set<string>();
        const allPlugins: Plugin[] = [];

        // 1. 扫描核心插件
        const corePlugins = await scanModules<Plugin>(corePluginDir, 'core', loadedNames, '插件', befly.pluginsConfig);

        // 2. 扫描组件插件
        const addonPlugins: Plugin[] = [];
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = getAddonDir(addon, 'plugins');
            const plugins = await scanModules<Plugin>(dir, 'addon', loadedNames, '插件', befly.pluginsConfig, addon);
            addonPlugins.push(...plugins);
        }

        // 3. 扫描项目插件
        const appPlugins = await scanModules<Plugin>(projectPluginDir, 'app', loadedNames, '插件', befly.pluginsConfig);

        // 4. 合并所有插件
        allPlugins.push(...corePlugins);
        allPlugins.push(...addonPlugins);
        allPlugins.push(...appPlugins);

        // 5. 排序与初始化
        const sortedPlugins = sortModules(allPlugins);
        if (sortedPlugins === false) {
            Logger.error('插件依赖关系错误，请检查 after 属性');
            process.exit(1);
        }

        for (const plugin of sortedPlugins) {
            try {
                await initPlugin(befly, plugin);
            } catch (error: any) {
                Logger.error(`插件 ${plugin.name} 初始化失败`, error);
                process.exit(1);
            }
        }
    } catch (error: any) {
        Logger.error('加载插件时发生错误', error);
        process.exit(1);
    }
}

// ==================== 钩子加载逻辑 ====================
// 已移动到 loadHooks.ts
