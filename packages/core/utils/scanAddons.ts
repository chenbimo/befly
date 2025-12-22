import { existsSync, readdirSync } from "node:fs";

import { camelCase } from "es-toolkit/string";
import { join, resolve } from "pathe";

import { appDir } from "../paths.js";
import { isDirentDirectory } from "./isDirentDirectory.js";

export type AddonSource = "addon" | "app";

export interface AddonInfo {
    /** addon 根目录绝对路径（node_modules/@befly-addon/<name>） */
    fullPath: string;

    /** addon 目录名（通常是 demo/admin 等） */
    name: string;

    /** camelCase(name) */
    camelName: string;
}

/** 从 node_modules/@befly-addon/ 扫描组件列表 */
export const scanAddons = (): AddonInfo[] => {
    const addons: AddonInfo[] = [];

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

        const fullPath = resolve(addonDir, entry.name);

        addons.push({
            fullPath: fullPath,
            name: entry.name,
            camelName: camelCase(entry.name)
        });
    }

    return addons;
};
