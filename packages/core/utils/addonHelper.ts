import { existsSync, readdirSync } from "node:fs";

import { join } from "pathe";

export type AddonSource = "addon" | "app";

export type AddonInfo = {
    name: string;
    /**
     * 来源语义（与模块加载的 source 语义对齐）：
     * - app: 来自项目内 addons/（本地组件，随项目交付）
     * - addon: 来自 node_modules/@befly-addon（已安装的组件包）
     */
    source: AddonSource;
    rootDir: string;
    apisDir: string | null;
    hooksDir: string | null;
    pluginsDir: string | null;
    tablesDir: string | null;
    viewsDir: string | null;
    adminViewsDir: string | null;
    appViewsDir: string | null;
    configsDir: string | null;
};

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 信息数组（包含来源、根目录、常用子目录路径）
 */
export const scanAddons = (cwd: string = process.cwd()): AddonInfo[] => {
    const addonPaths = new Map<string, string>();

    // 1. 收集本地 addons 目录路径
    const localAddonsDir = join(cwd, "addons");
    if (existsSync(localAddonsDir)) {
        try {
            const entries = readdirSync(localAddonsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                if (entry.name.startsWith("_")) {
                    continue;
                }

                const rootDir = join(localAddonsDir, entry.name);
                addonPaths.set(entry.name, rootDir);
            }
        } catch {
            // 忽略本地目录读取错误
        }
    }

    // 2. 收集 node_modules/@befly-addon 目录路径
    const beflyDir = join(cwd, "node_modules", "@befly-addon");
    if (existsSync(beflyDir)) {
        try {
            const entries = readdirSync(beflyDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                if (entry.name.startsWith("_")) {
                    continue;
                }
                // 如果本地已存在，跳过 npm 包版本（本地优先）
                if (addonPaths.has(entry.name)) {
                    continue;
                }

                const rootDir = join(beflyDir, entry.name);
                addonPaths.set(entry.name, rootDir);
            }
        } catch {
            // 忽略 npm 目录读取错误
        }
    }

    // 3. 合并后统一处理
    const addons: AddonInfo[] = [];
    for (const [name, rootDir] of addonPaths) {
        // 统一 source 语义：本地 addons/ 视为 app；node_modules/@befly-addon 视为 addon
        const source: AddonSource = rootDir.includes("@befly-addon") ? "addon" : "app";

        const childDirNames = new Set<string>();
        try {
            const entries = readdirSync(rootDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                childDirNames.add(entry.name);
            }
        } catch {
            // 忽略读取错误（例如权限问题）
        }

        const viewsDir = childDirNames.has("views") ? join(rootDir, "views") : null;
        const adminViewsDir = viewsDir && existsSync(join(viewsDir, "admin")) ? join(viewsDir, "admin") : null;
        const appViewsDir = viewsDir && existsSync(join(viewsDir, "app")) ? join(viewsDir, "app") : null;

        addons.push({
            name: name,
            source: source,
            rootDir: rootDir,
            apisDir: childDirNames.has("apis") ? join(rootDir, "apis") : null,
            hooksDir: childDirNames.has("hooks") ? join(rootDir, "hooks") : null,
            pluginsDir: childDirNames.has("plugins") ? join(rootDir, "plugins") : null,
            tablesDir: childDirNames.has("tables") ? join(rootDir, "tables") : null,
            viewsDir: viewsDir,
            adminViewsDir: adminViewsDir,
            appViewsDir: appViewsDir,
            configsDir: childDirNames.has("configs") ? join(rootDir, "configs") : null
        });
    }

    return addons.sort((a, b) => a.name.localeCompare(b.name));
};
