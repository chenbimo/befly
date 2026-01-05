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

function getCoreBuiltinName(value: any): string {
    // 直接使用导出对象的 name，不在工具层做任何“去空白/纠错”。
    // 合法性校验统一交给 checks（例如：必须是小写字母+下划线）。
    return value && typeof value.name === "string" ? value.name : "";
}

function toCoreBuiltinScanFileResult(type: CoreBuiltinType, item: any): ScanFileResult {
    const name = getCoreBuiltinName(item);

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
