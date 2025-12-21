import { existsSync, readdirSync } from "node:fs";

import { join, normalize, resolve } from "pathe";

import { coreDir, appDir, coreTableDir, appTableDir } from "../paths.js";
import { isDirentDirectory } from "./isDirentDirectory.js";
import { scanAddons } from "./scanAddons.js";
import { scanFiles } from "./scanFiles.js";

export type AddonSource = "addon" | "app";

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 信息数组（包含来源、根目录、常用子目录路径）
 */
export const scanSources = async (): Promise<AddonInfo[]> => {
    const apis = [];
    const plugins = [];
    const hooks = [];
    const tables = [];
    const views = [];

    const adddons = await scanAddons();

    // 处理核心项目 =================================
    tables.push(...(await scanFiles(appTableDir, "app", "*.json", {})));
    adddons.forEach(async (addon) => {
        tables.push(...(await scanFiles(join(addon.fullPath, "tables"), "addon", "*.json", {})));
    });
    console.log("🔥[ addonTable ]-30", tables);

    // 处理实际项目 =================================
    // 处理组件项目 =================================
};
