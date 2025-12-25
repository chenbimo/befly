import { existsSync, readdirSync } from "node:fs";

import { camelCase } from "es-toolkit/string";
import { join, resolve } from "pathe";

import { appAddonsDir, appDir } from "../paths.js";
import { isDirentDirectory } from "./isDirentDirectory.js";

export type AddonSource = "addon" | "app";

export interface AddonInfo {
    /** addon 来源 */
    source: AddonSource;

    /** addon 来源中文名 */
    sourceName: string;

    /** addon 名称（目录名，通常是 demo/admin 等） */
    name: string;

    /** camelCase(name) */
    camelName: string;

    /** addon 根目录绝对路径 */
    rootDir: string;

    /** 兼容字段：历史上使用 fullPath 表示 rootDir */
    fullPath: string;
}

/** 扫描 node_modules/@befly-addon + 项目 addons/（项目优先级更高） */
export const scanAddons = (): AddonInfo[] => {
    const addonMap = new Map<string, AddonInfo>();

    const scanBaseDir = (baseDir: string, source: AddonSource, sourceName: string) => {
        if (!existsSync(baseDir)) {
            return;
        }

        const entries = readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith("_")) {
                continue;
            }

            if (!isDirentDirectory(baseDir, entry)) {
                continue;
            }

            const rootDir = resolve(baseDir, entry.name);

            const info: AddonInfo = {
                source: source,
                sourceName: sourceName,
                name: entry.name,
                camelName: camelCase(entry.name),
                rootDir: rootDir,
                fullPath: rootDir
            };

            addonMap.set(entry.name, info);
        }
    };

    // node_modules 中的 @befly-addon
    scanBaseDir(join(appDir, "node_modules", "@befly-addon"), "addon", "组件");

    // 项目本地 addons（同名覆盖 node_modules）
    scanBaseDir(appAddonsDir, "app", "项目");

    return Array.from(addonMap.values());
};
