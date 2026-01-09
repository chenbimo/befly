import type { ScanFileResult, ScanFileResultBase, ScanFileType } from "./scanFiles";

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

type CoreBuiltinScanFileResult = ScanFileResultBase & {
    type: Exclude<ScanFileType, "table">;
} & Record<string, unknown>;

function toCoreBuiltinScanFileResult(type: CoreBuiltinType, item: unknown): CoreBuiltinScanFileResult {
    const record = (isPlainObject(item) ? item : {}) as Record<string, unknown>;
    const name = typeof record["name"] === "string" ? String(record["name"]) : "";

    const customKeys = isPlainObject(item) ? Object.keys(item) : [];
    const depsRaw = record["deps"];
    const deps = Array.isArray(depsRaw) ? depsRaw.filter((x): x is string => typeof x === "string") : [];

    const out: CoreBuiltinScanFileResult = {
        source: "core",
        type: type,
        sourceName: "核心",
        filePath: `core:${type}:${name}`,
        relativePath: name,
        fileName: name,
        moduleName: name,
        addonName: "",
        fileBaseName: name,
        fileDir: "(builtin)",

        name: name,
        enable: record["enable"],
        deps: deps,
        handler: record["handler"] ?? null,

        customKeys: customKeys
    };

    return out;
}

export function scanCoreBuiltinPlugins(): ScanFileResult[] {
    const plugins: ScanFileResult[] = [];

    const builtinPlugins: unknown[] = [
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
    for (const plugin of builtinPlugins) {
        plugins.push(toCoreBuiltinScanFileResult("plugin", plugin) as ScanFileResult);
    }

    return plugins;
}

export function scanCoreBuiltinHooks(): ScanFileResult[] {
    const hooks: ScanFileResult[] = [];

    const builtinHooks: unknown[] = [
        //
        coreHookAuth,
        coreHookCors,
        coreHookParser,
        coreHookValidator,
        coreHookPermission
    ];
    for (const hook of builtinHooks) {
        hooks.push(toCoreBuiltinScanFileResult("hook", hook) as ScanFileResult);
    }

    return hooks;
}
