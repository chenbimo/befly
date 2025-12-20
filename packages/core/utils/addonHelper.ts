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
    const candidates: Array<{ name: string; source: AddonSource; rootDir: string }> = [];

    // 1. 先收集所有来源的组件路径（不做重名去重：来源不同可在后续逻辑中区分）
    const scanDirs: Array<{ dir: string; source: AddonSource }> = [
        { dir: join(cwd, "addons"), source: "app" },
        { dir: join(cwd, "node_modules", "@befly-addon"), source: "addon" }
    ];

    for (const scan of scanDirs) {
        if (!existsSync(scan.dir)) {
            continue;
        }

        try {
            const entries = readdirSync(scan.dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) {
                    continue;
                }
                if (entry.name.startsWith("_")) {
                    continue;
                }

                candidates.push({
                    name: entry.name,
                    source: scan.source,
                    rootDir: join(scan.dir, entry.name)
                });
            }
        } catch {
            // 忽略目录读取错误
        }
    }

    // 2. 统一处理候选项，补齐各类子目录路径
    const addons: AddonInfo[] = [];
    for (const candidate of candidates) {
        const name = candidate.name;
        const source = candidate.source;
        const rootDir = candidate.rootDir;

        // 这里不枚举 rootDir 下的所有目录项（readdirSync），而是仅探测我们关心的固定子目录集合。
        // 在 addon 目录项很多时，这通常会更省。
        const apisDir = existsSync(join(rootDir, "apis")) ? join(rootDir, "apis") : null;
        const hooksDir = existsSync(join(rootDir, "hooks")) ? join(rootDir, "hooks") : null;
        const pluginsDir = existsSync(join(rootDir, "plugins")) ? join(rootDir, "plugins") : null;
        const tablesDir = existsSync(join(rootDir, "tables")) ? join(rootDir, "tables") : null;
        const configsDir = existsSync(join(rootDir, "configs")) ? join(rootDir, "configs") : null;

        const viewsDir = existsSync(join(rootDir, "views")) ? join(rootDir, "views") : null;
        const adminViewsDir = viewsDir && existsSync(join(rootDir, "views", "admin")) ? join(rootDir, "views", "admin") : null;
        const appViewsDir = viewsDir && existsSync(join(rootDir, "views", "app")) ? join(rootDir, "views", "app") : null;

        addons.push({
            name: name,
            source: source,
            rootDir: rootDir,
            apisDir: apisDir,
            hooksDir: hooksDir,
            pluginsDir: pluginsDir,
            tablesDir: tablesDir,
            viewsDir: viewsDir,
            adminViewsDir: adminViewsDir,
            appViewsDir: appViewsDir,
            configsDir: configsDir
        });
    }

    return addons.sort((a, b) => {
        const nameCmp = a.name.localeCompare(b.name);
        if (nameCmp !== 0) {
            return nameCmp;
        }
        return a.source.localeCompare(b.source);
    });
};
