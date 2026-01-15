import type { AddonInfo } from "./scanAddons";
import type { ScanFileResult } from "./scanFiles";

import { join } from "pathe";

import { appDir } from "../paths";
import { scanAddons } from "./scanAddons";
import { scanCoreBuiltinHooks, scanCoreBuiltinPlugins } from "./scanCoreBuiltins";
import { scanFiles } from "./scanFiles";

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
        tables.push(...(await scanFiles(join(addon.rootDir, "tables"), "addon", "table", "*.json")));
    }

    // 处理插件
    // core 内置插件：必须静态导入（支持 bun bundle 单文件）。
    // 约束：core 插件名由 export default.name 指定。
    plugins.push(...scanCoreBuiltinPlugins());
    plugins.push(...(await scanFiles(join(appDir, "plugins"), "app", "plugin", "*.{ts,js}")));

    for (const addon of addons) {
        plugins.push(...(await scanFiles(join(addon.rootDir, "plugins"), "addon", "plugin", "*.{ts,js}")));
    }

    // 处理钩子
    // core 内置钩子：必须静态导入（支持 bun bundle 单文件）。
    // 约束：core 钩子名由 export default.name 指定。
    hooks.push(...scanCoreBuiltinHooks());
    hooks.push(...(await scanFiles(join(appDir, "hooks"), "app", "hook", "*.{ts,js}")));

    for (const addon of addons) {
        hooks.push(...(await scanFiles(join(addon.rootDir, "hooks"), "addon", "hook", "*.{ts,js}")));
    }

    // 处理接口
    // 说明：core 没有内置 apis；接口只从「项目(app)」与「组件(addon)」中扫描加载。
    apis.push(...(await scanFiles(join(appDir, "apis"), "app", "api", "**/*.{ts,js}")));

    for (const addon of addons) {
        apis.push(...(await scanFiles(join(addon.rootDir, "apis"), "addon", "api", "**/*.{ts,js}")));
    }

    return {
        hooks: hooks,
        plugins: plugins,
        apis: apis,
        tables: tables,
        addons: addons
    };
};
