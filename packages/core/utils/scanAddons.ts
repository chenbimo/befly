import { existsSync, readdirSync } from "node:fs";

import { camelCase } from "es-toolkit/string";
import { join, normalize, resolve } from "pathe";

import { appDir } from "../paths.js";
import { isDirentDirectory } from "./isDirentDirectory.js";

export type AddonSource = "addon" | "app";

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 信息数组（包含来源、根目录、常用子目录路径）
 */
export const scanAddons = (): AddonInfo[] => {
    const addons = [];

    const addonDir = join(appDir, "node_modules", "@befly-addon");

    if (!existsSync(addonDir)) {
        return [];
    }

    const entries = readdirSync(addonDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith("_")) {
            continue;
        }

        if (!isDirentDirectory(addonDir, entry)) {
            continue;
        }

        addons.push({
            fullPath: resolve(addonDir, entry.name),
            name: entry.name,
            camelName: camelCase(entry.name)
        });
    }
    return addons;
};
