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
import { isPlainObject } from "./util";

type CoreBuiltinType = "hook" | "plugin";

function toCoreBuiltinScanFileResult(type: CoreBuiltinType, item: any): ScanFileResult {
    const name = item.name;

    const customKeys = isPlainObject(item) ? Object.keys(item) : [];

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
        handler: item ? item.handler : null,

        customKeys: customKeys
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
