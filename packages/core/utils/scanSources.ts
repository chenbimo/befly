import type { AddonInfo } from "./scanAddons.ts";
import type { ScanFileResult } from "./scanFiles.ts";

import { join } from "pathe";

import { coreDir, appDir } from "../paths.ts";
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
    plugins.push(...(await scanFiles(join(coreDir, "plugins"), "core", "plugin", "*.ts")));
    plugins.push(...(await scanFiles(join(appDir, "plugins"), "app", "plugin", "*.ts")));

    for (const addon of addons) {
        plugins.push(...(await scanFiles(join(addon.fullPath, "plugins"), "addon", "plugin", "*.ts")));
    }

    // 处理接口
    apis.push(...(await scanFiles(join(coreDir, "apis"), "core", "api", "**/*.ts")));
    apis.push(...(await scanFiles(join(appDir, "apis"), "app", "api", "**/*.ts")));

    for (const addon of addons) {
        apis.push(...(await scanFiles(join(addon.fullPath, "apis"), "addon", "api", "**/*.ts")));
    }

    // 处理钩子
    hooks.push(...(await scanFiles(join(coreDir, "hooks"), "core", "hook", "*.ts")));
    hooks.push(...(await scanFiles(join(appDir, "hooks"), "app", "hook", "*.ts")));

    for (const addon of addons) {
        hooks.push(...(await scanFiles(join(addon.fullPath, "hooks"), "addon", "hook", "*.ts")));
    }

    return {
        hooks: hooks,
        plugins: plugins,
        apis: apis,
        tables: tables,
        addons: addons
    };
};
