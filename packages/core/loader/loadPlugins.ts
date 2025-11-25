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

export async function loadPlugins(befly: {
    //
    pluginLists: Plugin[];
    appContext: BeflyContext;
    pluginsConfig?: Record<string, any>;
}): Promise<void> {
    try {
        const allPlugins: Plugin[] = [];

        // 1. 扫描核心插件
        const corePlugins = await scanModules<Plugin>(corePluginDir, 'core', '插件', befly.pluginsConfig);

        // 2. 扫描组件插件
        const addonPlugins: Plugin[] = [];
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = getAddonDir(addon, 'plugins');
            const plugins = await scanModules<Plugin>(dir, 'addon', '插件', befly.pluginsConfig, addon);
            addonPlugins.push(...plugins);
        }

        // 3. 扫描项目插件
        const appPlugins = await scanModules<Plugin>(projectPluginDir, 'app', '插件', befly.pluginsConfig);

        // 4. 合并所有插件
        allPlugins.push(...corePlugins);
        allPlugins.push(...addonPlugins);
        allPlugins.push(...appPlugins);

        // 5. 过滤禁用的插件
        const disablePlugins = (befly as any).config?.disablePlugins || [];
        const enabledPlugins = allPlugins.filter((plugin) => !disablePlugins.includes(plugin.name));

        if (disablePlugins.length > 0) {
            Logger.info(`禁用插件: ${disablePlugins.join(', ')}`);
        }

        // 6. 排序与初始化
        const sortedPlugins = sortModules(enabledPlugins);
        if (sortedPlugins === false) {
            Logger.error('插件依赖关系错误，请检查 after 属性');
            process.exit(1);
        }

        for (const plugin of sortedPlugins) {
            try {
                befly.pluginLists.push(plugin);

                const pluginInstance = typeof plugin.handler === 'function' ? await plugin.handler(befly.appContext) : {};

                // 直接挂载到 befly 下
                (befly.appContext as any)[plugin.name!] = pluginInstance;
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
