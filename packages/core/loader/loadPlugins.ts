/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import type { BeflyContext } from "../types/befly.ts";
import type { Plugin } from "../types/plugin.ts";
import type { ScanFileResult } from "../utils/scanFiles.ts";

import { Logger } from "../lib/logger.ts";
import { sortModules } from "../utils/sortModules.ts";

export async function loadPlugins(plugins: ScanFileResult[], context: BeflyContext, disablePlugins: string[] = []): Promise<Plugin[]> {
    const pluginsMap: Plugin[] = [];

    if (disablePlugins.length > 0) {
        Logger.info({ plugins: disablePlugins }, "禁用插件");
    }

    const enabledPlugins = plugins.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }
        if (disablePlugins.includes(moduleName)) {
            return false;
        }
        return true;
    });

    const sortedPlugins = sortModules(enabledPlugins, { moduleLabel: "插件" });
    if (sortedPlugins === false) {
        throw new Error("插件依赖关系错误");
    }

    for (const item of sortedPlugins) {
        const pluginName = (item as any).moduleName as string;
        const plugin = item as any as Plugin;

        try {
            const pluginInstance = typeof plugin.handler === "function" ? await plugin.handler(context) : {};
            (context as any)[pluginName] = pluginInstance;

            pluginsMap.push({
                name: pluginName,
                deps: plugin.deps,
                handler: plugin.handler
            });
        } catch (error: any) {
            Logger.error({ err: error, plugin: pluginName }, "插件初始化失败");
            throw error;
        }
    }

    return pluginsMap;
}
