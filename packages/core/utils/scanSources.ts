import { join } from "pathe";

import { coreDir, appDir } from "../paths.js";
import { scanAddons } from "./scanAddons.js";
import { scanFiles } from "./scanFiles.js";

export type ScanSourcesResult = {
    hooks: any[];
    plugins: any[];
    apis: any[];
    tables: any[];
    adddons: any[];
};

export const scanSources = async (): Promise<ScanSourcesResult> => {
    const apis = [];
    const plugins = [];
    const hooks = [];
    const tables = [];

    const adddons = await scanAddons();

    // 处理表格
    tables.push(...(await scanFiles(join(appDir, "tables"), "app", "table", "*.json", {})));

    for (const addon of adddons) {
        tables.push(...(await scanFiles(join(addon.fullPath, "tables"), "addon", "table", "*.json", {})));
    }

    // 处理插件
    plugins.push(...(await scanFiles(join(coreDir, "plugins"), "core", "plugin", "*.ts", {})));
    plugins.push(...(await scanFiles(join(appDir, "plugins"), "app", "plugin", "*.ts", {})));

    for (const addon of adddons) {
        plugins.push(...(await scanFiles(join(addon.fullPath, "plugins"), "addon", "plugin", "*.ts", {})));
    }

    // 处理接口
    apis.push(...(await scanFiles(join(coreDir, "apis"), "core", "api", "**/*.ts", {})));
    apis.push(...(await scanFiles(join(appDir, "apis"), "app", "api", "**/*.ts", {})));

    for (const addon of adddons) {
        apis.push(...(await scanFiles(join(addon.fullPath, "apis"), "addon", "api", "**/*.ts", {})));
    }

    // 处理钩子
    hooks.push(...(await scanFiles(join(coreDir, "hooks"), "core", "hook", "*.ts", {})));
    hooks.push(...(await scanFiles(join(appDir, "hooks"), "app", "hook", "*.ts", {})));

    for (const addon of adddons) {
        hooks.push(...(await scanFiles(join(addon.fullPath, "hooks"), "addon", "hook", "*.ts", {})));
    }

    return {
        hooks: hooks,
        plugins: plugins,
        apis: apis,
        tables: tables,
        adddons: adddons
    };
};
