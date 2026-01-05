import type { ScanFileResult } from "./scanFiles";

import coreHookAuth from "../hooks/auth";
import coreHookCors from "../hooks/cors";
import coreHookParser from "../hooks/parser";
import coreHookPermission from "../hooks/permission";
import coreHookValidator from "../hooks/validator";
import corePluginCache from "../plugins/cache";
import corePluginCipher from "../plugins/cipher";
import corePluginConfig from "../plugins/config";
import corePluginDb from "../plugins/db";
import corePluginJwt from "../plugins/jwt";
import corePluginLogger from "../plugins/logger";
import corePluginRedis from "../plugins/redis";
import corePluginTool from "../plugins/tool";

type CoreBuiltinType = "hook" | "plugin";

function ensureCoreBuiltinName(value: any, type: CoreBuiltinType): string {
    const name = value && typeof value.name === "string" ? value.name.trim() : "";
    if (name === "") {
        const label = type === "hook" ? "钩子" : "插件";
        throw new Error(`core 内置${label}必须显式设置 name 属性（string）`);
    }
    return name;
}

function toCoreBuiltinScanFileResult(type: CoreBuiltinType, item: any): ScanFileResult {
    const name = ensureCoreBuiltinName(item, type);

    return {
        source: "core",
        type: type as any,
        sourceName: "核心",
        filePath: `core:${type}:${name}`,
        relativePath: name,
        fileName: name,
        moduleName: name,
        addonName: "",
        fileBaseName: name,
        fileDir: "(builtin)",

        name: name,
        enable: item ? item.enable : undefined,
        deps: Array.isArray(item && item.deps) ? item.deps : [],
        handler: item ? item.handler : null
    } as any;
}

export function scanCoreBuiltinPlugins(): ScanFileResult[] {
    const plugins: ScanFileResult[] = [];

    const builtinPlugins = [
        //
        corePluginLogger,
        corePluginRedis,
        corePluginDb,
        corePluginCache,
        corePluginTool,
        corePluginCipher,
        corePluginJwt,
        corePluginConfig
    ];
    for (const plugin of builtinPlugins as any[]) {
        plugins.push(toCoreBuiltinScanFileResult("plugin", plugin));
    }

    return plugins;
}

export function scanCoreBuiltinHooks(): ScanFileResult[] {
    const hooks: ScanFileResult[] = [];

    const builtinHooks = [
        //
        coreHookAuth,
        coreHookCors,
        coreHookParser,
        coreHookValidator,
        coreHookPermission
    ];
    for (const hook of builtinHooks as any[]) {
        hooks.push(toCoreBuiltinScanFileResult("hook", hook));
    }

    return hooks;
}
