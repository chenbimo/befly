/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";

import { beflyConfig } from "../befly.config.js";
import { Logger } from "../lib/logger.js";
import { corePluginDir, projectPluginDir } from "../paths.js";
import { scanAddons } from "../utils/addonHelper.js";
import { sortModules, scanModules } from "../utils/modules.js";

export async function loadPlugins(plugins: Plugin[], context: BeflyContext): Promise<void> {
    try {
        const allPlugins: Plugin[] = [];

        // 1. 扫描核心插件
        const corePlugins = await scanModules<Plugin>(corePluginDir, "core", "插件");

        // 2. 扫描组件插件
        const addonPlugins: Plugin[] = [];
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = addon.pluginsDir;
            if (!dir) {
                continue;
            }
            const plugins = await scanModules<Plugin>(dir, "addon", "插件", addon.name);
            addonPlugins.push(...plugins);
        }

        // 3. 扫描项目插件
        const appPlugins = await scanModules<Plugin>(projectPluginDir, "app", "插件");

        // 4. 合并所有插件
        allPlugins.push(...corePlugins);
        allPlugins.push(...addonPlugins);
        allPlugins.push(...appPlugins);

        // 5. 过滤禁用的插件
        const disablePlugins = beflyConfig.disablePlugins || [];
        const enabledPlugins = allPlugins.filter((plugin) => plugin.name && !disablePlugins.includes(plugin.name));

        if (disablePlugins.length > 0) {
            Logger.info({ plugins: disablePlugins }, "禁用插件");
        }

        // 6. 排序与初始化
        const sortedPlugins = sortModules(enabledPlugins);
        if (sortedPlugins === false) {
            Logger.error("插件依赖关系错误，请检查 after 属性");
            process.exit(1);
        }

        for (const plugin of sortedPlugins) {
            try {
                plugins.push(plugin);

                const pluginInstance = typeof plugin.handler === "function" ? await plugin.handler(context) : {};

                // 直接挂载到 befly 下
                (context as any)[plugin.name!] = pluginInstance;
            } catch (error: any) {
                Logger.error({ err: error, plugin: plugin.name }, "插件初始化失败");
                process.exit(1);
            }
        }
    } catch (error: any) {
        Logger.error({ err: error }, "加载插件时发生错误");
        process.exit(1);
    }
}
