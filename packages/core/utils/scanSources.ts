import type { AddonInfo } from "./scanAddons.ts";
import type { ScanFileResult } from "./scanFiles.ts";

import { join } from "pathe";

import { coreDistDir, appDir } from "../paths.ts";
import { scanAddons } from "./scanAddons.ts";
import { scanFiles } from "./scanFiles.ts";

export type ScanSourcesResult = {
    hooks: ScanFileResult[];
    plugins: ScanFileResult[];
    apis: ScanFileResult[];
    tables: ScanFileResult[];
    addons: AddonInfo[];
};

export const scanSources = async (): Promise<ScanSourcesResult> => {
    const apis: ScanFileResult[] = [];
    const plugins: ScanFileResult[] = [];
    const hooks: ScanFileResult[] = [];
    const tables: ScanFileResult[] = [];

    const addons: AddonInfo[] = await scanAddons();

    // 处理表格
    tables.push(...(await scanFiles(join(appDir, "tables"), "app", "table", "*.json")));

    for (const addon of addons) {
        tables.push(...(await scanFiles(join(addon.fullPath, "tables"), "addon", "table", "*.json")));
    }

    // 处理插件
    plugins.push(...(await scanFiles(join(coreDistDir, "plugins"), "core", "plugin", "*.js")));
    plugins.push(...(await scanFiles(join(appDir, "plugins"), "app", "plugin", "*.{ts,js}")));

    for (const addon of addons) {
        plugins.push(...(await scanFiles(join(addon.fullPath, "plugins"), "addon", "plugin", "*.{ts,js}")));
    }

    // 处理接口
    apis.push(...(await scanFiles(join(coreDistDir, "apis"), "core", "api", "**/*.js")));
    apis.push(...(await scanFiles(join(appDir, "apis"), "app", "api", "**/*.{ts,js}")));

    for (const addon of addons) {
        apis.push(...(await scanFiles(join(addon.fullPath, "apis"), "addon", "api", "**/*.{ts,js}")));
    }

    // 处理钩子
    hooks.push(...(await scanFiles(join(coreDistDir, "hooks"), "core", "hook", "*.js")));
    hooks.push(...(await scanFiles(join(appDir, "hooks"), "app", "hook", "*.{ts,js}")));

    for (const addon of addons) {
        hooks.push(...(await scanFiles(join(addon.fullPath, "hooks"), "addon", "hook", "*.{ts,js}")));
    }

    return {
        hooks: hooks,
        plugins: plugins,
        apis: apis,
        tables: tables,
        addons: addons
    };
};
