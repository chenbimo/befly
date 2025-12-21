import { join } from "pathe";

import { coreDir, appDir } from "../paths.js";
import { scanAddons } from "./scanAddons.js";
import { scanFiles } from "./scanFiles.js";

export const scanSources = async (): Promise<AddonInfo[]> => {
    const apis = [];
    const plugins = [];
    const hooks = [];
    const tables = [];

    const adddons = await scanAddons();

    // 处理表格
    tables.push(...(await scanFiles(join(appDir, "tables"), "app", "*.json", {})));

    for (const addon of adddons) {
        tables.push(...(await scanFiles(join(addon.fullPath, "tables"), "addon", "*.json", {})));
    }

    // 处理插件
    plugins.push(...(await scanFiles(join(coreDir, "plugins"), "core", "*.ts", {})));
    plugins.push(...(await scanFiles(join(appDir, "plugins"), "app", "*.ts", {})));

    for (const addon of adddons) {
        plugins.push(...(await scanFiles(join(addon.fullPath, "plugins"), "addon", "*.ts", {})));
    }

    // 处理接口
    apis.push(...(await scanFiles(join(coreDir, "apis"), "core", "**/*.ts", {})));
    apis.push(...(await scanFiles(join(appDir, "apis"), "app", "**/*.ts", {})));

    for (const addon of adddons) {
        apis.push(...(await scanFiles(join(addon.fullPath, "apis"), "addon", "**/*.ts", {})));
    }

    // 处理钩子
    hooks.push(...(await scanFiles(join(coreDir, "hooks"), "core", "*.ts", {})));
    hooks.push(...(await scanFiles(join(appDir, "hooks"), "app", "*.ts", {})));

    for (const addon of adddons) {
        hooks.push(...(await scanFiles(join(addon.fullPath, "hooks"), "addon", "*.ts", {})));
    }

    return { hooks, plugins, apis, tables, adddons };
};
