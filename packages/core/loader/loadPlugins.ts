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

    const enabledPlugins = plugins.filter((item) => {
        const moduleName = item.moduleName;
        if (typeof moduleName !== "string" || moduleName.trim() === "") {
            return false;
        }

        // enable=false 表示禁用（替代 disablePlugins 列表）。
        // enable 仅允许 boolean；缺失 enable 的默认值应在 checkPlugin 阶段被补全为 true。
        const enable = Object.hasOwn(item, "enable") ? (item as { enable?: unknown }).enable : undefined;
        if (enable === false) {
            return false;
        }
        return true;
    });

    const sortedPlugins = sortModules(enabledPlugins, { moduleLabel: "插件" });
    if (sortedPlugins === false) {
        throw new Error("插件依赖关系错误");
    }

    for (const item of sortedPlugins) {
        const pluginName = item.moduleName;
        const depsRaw = Object.hasOwn(item, "deps") ? (item as { deps?: unknown }).deps : undefined;
        const deps = Array.isArray(depsRaw) ? depsRaw.filter((x): x is string => typeof x === "string") : [];

        const handlerRaw = Object.hasOwn(item, "handler") ? (item as { handler?: unknown }).handler : undefined;
        if (typeof handlerRaw !== "function") {
            throw new Error(`插件 '${pluginName}' handler 必须是函数`);
        }
        const handler = handlerRaw as Plugin["handler"];

        try {
            const pluginInstance = await handler(context);
            (context as Record<string, unknown>)[pluginName] = pluginInstance;

            pluginsMap.push({
                name: pluginName,
                enable: true,
                deps: deps,
                handler: handler
            });
        } catch (error: unknown) {
            Logger.error({ err: error, plugin: pluginName, msg: "插件初始化失败" });
            throw error;
        }
    }

    return pluginsMap;
}
