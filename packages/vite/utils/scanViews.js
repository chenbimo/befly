import { existsSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

/**
 * 扫描项目和所有 @befly-addon 包的视图目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 *
 * 约定：addon 只允许从 adminViews 扫描路由：
 * - <addonRoot>/adminViews
 *
 * 注意：此函数只能在 vite.config.js 中使用（Node.js 环境），不能在浏览器中使用
 * @returns {Array<{ src: string, path: string, exclude: string[] }>} 路由文件夹配置数组
 */
export function scanViews() {
    const appRoot = process.cwd();
    const addonBasePath = join(appRoot, "node_modules", "@befly-addon");

    /** @type {Array<{ src: string, path: string, exclude: string[] }>} */
    const routesFolders = [];

    // 1. 项目自身 views
    const appViewsPath = join(appRoot, "src", "views");
    if (existsSync(appViewsPath)) {
        routesFolders.push({
            src: realpathSync(appViewsPath),
            path: "",
            exclude: ["**/components/**"]
        });
    }

    // 2. 扫描 @befly-addon/*/adminViews（仅此目录允许生成 addon 路由）
    if (!existsSync(addonBasePath)) {
        return routesFolders;
    }

    try {
        const addonDirs = readdirSync(addonBasePath);

        for (const addonName of addonDirs) {
            const addonPath = join(addonBasePath, addonName);
            if (!existsSync(addonPath)) {
                continue;
            }

            const adminViewsPath = join(addonPath, "adminViews");
            if (existsSync(adminViewsPath)) {
                routesFolders.push({
                    src: realpathSync(adminViewsPath),
                    path: `addon/${addonName}/`,
                    exclude: ["**/components/**"]
                });
            }
        }
    } catch {
        // 扫描失败保持静默，避免影响 Vite 启动
    }

    return routesFolders;
}
