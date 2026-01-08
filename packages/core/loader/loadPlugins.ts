/**
 * 插件加载器
 * 负责扫描和初始化所有插件（核心、组件、项目）
 */

import type { BeflyContext } from "../types/befly";
import type { Plugin } from "../types/plugin";
import type { ScanFileResult } from "../utils/scanFiles";

import { Logger } from "../lib/logger";
import { sortModules } from "../utils/sortModules";

export async function loadPlugins(plugins: ScanFileResult[], context: BeflyContext): Promise<Plugin[]> {
    const pluginsMap: Plugin[] = [];

    const enabledPlugins = plugins.filter((item: any) => {
        const moduleName = item?.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }

        // enable=false 表示禁用（替代 disablePlugins 列表）。
        // enable 仅允许 boolean；缺失 enable 的默认值应在 checkPlugin 阶段被补全为 true。
        if (item?.enable === false) {
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
                enable: true,
                deps: Array.isArray(plugin.deps) ? plugin.deps : [],
                handler: plugin.handler
            });
        } catch (error: any) {
            Logger.error({ err: error, plugin: pluginName, msg: "插件初始化失败" });
            throw error;
        }
    }

    return pluginsMap;
}
