/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import type { BeflyContext } from "../types/befly.js";
import type { Plugin } from "../types/plugin.js";
import type { ScanFileResult } from "../utils/scanFiles.js";

import { Logger } from "../lib/logger.js";
import { sortModules } from "../utils/sortModules.js";

export async function loadPlugins(pluginItems: ScanFileResult[], context: BeflyContext, disablePlugins: string[] = []): Promise<Plugin[]> {
    const loadedPlugins: Plugin[] = [];

    if (disablePlugins.length > 0) {
        Logger.info({ plugins: disablePlugins }, "禁用插件");
    }

    const enabledPluginItems = pluginItems.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }
        if (disablePlugins.includes(moduleName)) {
            return false;
        }
        return true;
    });

    const sortedPluginItems = sortModules(enabledPluginItems, { moduleLabel: "插件" });
    if (sortedPluginItems === false) {
        throw new Error("插件依赖关系错误");
    }

    for (const item of sortedPluginItems) {
        const pluginName = (item as any).moduleName as string;
        const plugin = (item as any).content as Plugin;

        try {
            const pluginInstance = typeof plugin.handler === "function" ? await plugin.handler(context) : {};
            (context as any)[pluginName] = pluginInstance;

            loadedPlugins.push({
                name: pluginName,
                deps: plugin.deps,
                handler: plugin.handler
            });
        } catch (error: any) {
            Logger.error({ err: error, plugin: pluginName }, "插件初始化失败");
            throw error;
        }
    }

    return loadedPlugins;
}
