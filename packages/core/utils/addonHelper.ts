import fs from "node:fs";
import { existsSync } from "node:fs";

import { join } from "pathe";

export type AddonSource = "addon";

export type AddonDirs = {
    apisDir: string | null;
    hooksDir: string | null;
    pluginsDir: string | null;
    tablesDir: string | null;
    viewsDir: string | null;
    configsDir: string | null;
};

export type AddonInfo = {
    name: string;
    source: AddonSource;
    rootDir: string;
    dirs: AddonDirs;
};

function buildAddonDirs(rootDir: string): AddonDirs {
    const childDirNames = new Set<string>();

    try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            childDirNames.add(entry.name);
        }
    } catch {
        // 忽略读取错误（例如权限问题）
    }

    return {
        apisDir: childDirNames.has("apis") ? join(rootDir, "apis") : null,
        hooksDir: childDirNames.has("hooks") ? join(rootDir, "hooks") : null,
        pluginsDir: childDirNames.has("plugins") ? join(rootDir, "plugins") : null,
        tablesDir: childDirNames.has("tables") ? join(rootDir, "tables") : null,
        viewsDir: childDirNames.has("views") ? join(rootDir, "views") : null,
        configsDir: childDirNames.has("configs") ? join(rootDir, "configs") : null
    };
}

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 信息数组（包含来源、根目录、常用子目录路径）
 */
export const scanAddons = (cwd: string = process.cwd()): AddonInfo[] => {
    const addons = new Map<string, AddonInfo>();

    // 1. 扫描本地 addons 目录（优先级高）
    const localAddonsDir = join(cwd, "addons");
    if (existsSync(localAddonsDir)) {
        try {
            const entries = fs.readdirSync(localAddonsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                if (entry.name.startsWith("_")) {
                    continue;
                }

                const rootDir = join(localAddonsDir, entry.name);
                addons.set(entry.name, {
                    name: entry.name,
                    source: "addon",
                    rootDir: rootDir,
                    dirs: buildAddonDirs(rootDir)
                });
            }
        } catch {
            // 忽略本地目录读取错误
        }
    }

    // 2. 扫描 node_modules/@befly-addon 目录
    const beflyDir = join(cwd, "node_modules", "@befly-addon");
    if (existsSync(beflyDir)) {
        try {
            const entries = fs.readdirSync(beflyDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                if (entry.name.startsWith("_")) {
                    continue;
                }
                // 如果本地已存在，跳过 npm 包版本
                if (addons.has(entry.name)) {
                    continue;
                }

                const rootDir = join(beflyDir, entry.name);
                addons.set(entry.name, {
                    name: entry.name,
                    source: "addon",
                    rootDir: rootDir,
                    dirs: buildAddonDirs(rootDir)
                });
            }
        } catch {
            // 忽略 npm 目录读取错误
        }
    }

    return Array.from(addons.values()).sort((a, b) => a.name.localeCompare(b.name));
};
