import { existsSync, readdirSync, statSync } from "node:fs";

import { join, normalize, resolve } from "pathe";

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

type ScanAddonsCacheEntry = {
    addons: AddonInfo[];
};

// 进程内缓存：只用于启动/同步/检测阶段，同一进程内多处调用 scanAddons 时避免重复扫磁盘。
// 组件在运行过程中不会动态变化，因此不提供“强制刷新”语义。
const scanAddonsCache = new Map<string, ScanAddonsCacheEntry>();

const normalizeScanAddonsCacheKey = (cwd: string): string => {
    // - resolve: 折叠相对路径（例如 ./、../）
    // - normalize: 统一分隔符与尾随斜杠等
    // - win32: 盘符大小写不应影响缓存命中
    const normalized = normalize(resolve(cwd));
    if (process.platform === "win32") {
        return normalized.toLowerCase();
    }
    return normalized;
};

const cloneAddonInfo = (addon: AddonInfo): AddonInfo => {
    return {
        name: addon.name,
        source: addon.source,
        rootDir: addon.rootDir,
        apisDir: addon.apisDir,
        hooksDir: addon.hooksDir,
        pluginsDir: addon.pluginsDir,
        tablesDir: addon.tablesDir,
        viewsDir: addon.viewsDir,
        adminViewsDir: addon.adminViewsDir,
        appViewsDir: addon.appViewsDir,
        configsDir: addon.configsDir
    };
};

const cloneAddonInfos = (addons: AddonInfo[]): AddonInfo[] => {
    // AddonInfo 是纯 string/null 的扁平对象：不需要深拷贝。
    // 这里对数组与对象做浅拷贝即可避免调用方修改返回值污染缓存。
    return addons.map((addon) => cloneAddonInfo(addon));
};

const isDirentDirectory = (parentDir: string, entry: any): boolean => {
    if (typeof entry?.isDirectory === "function" && entry.isDirectory()) {
        return true;
    }

    // 兼容 Windows 下的 junction / workspace link：Dirent.isDirectory() 可能为 false，但它实际指向目录。
    const isSymbolicLink = typeof entry?.isSymbolicLink === "function" ? entry.isSymbolicLink() : false;
    if (!isSymbolicLink) {
        return false;
    }

    try {
        const stats = statSync(join(parentDir, entry.name));
        return stats.isDirectory();
    } catch {
        return false;
    }
};

/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 信息数组（包含来源、根目录、常用子目录路径）
 */
export const scanAddons = (cwd: string = process.cwd()): AddonInfo[] => {
    const cacheKey = normalizeScanAddonsCacheKey(cwd);

    const cached = scanAddonsCache.get(cacheKey);
    if (cached) {
        return cloneAddonInfos(cached.addons);
    }

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
                if (entry.name.startsWith("_")) {
                    continue;
                }

                if (!isDirentDirectory(scan.dir, entry)) {
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

    const sortedAddons = addons.sort((a, b) => {
        const nameCmp = a.name.localeCompare(b.name);
        if (nameCmp !== 0) {
            return nameCmp;
        }
        return a.source.localeCompare(b.source);
    });

    scanAddonsCache.set(cacheKey, {
        addons: sortedAddons
    });

    return cloneAddonInfos(sortedAddons);
};
