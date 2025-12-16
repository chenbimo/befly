import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 扫描项目和所有 @befly-addon 包的 views 目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 * 注意：此函数只能在 vite.config.js 中使用（Node.js 环境），不能在浏览器中使用
 * @returns {Array<{ src: string, path: string, exclude: string[] }>} 路由文件夹配置数组
 */
export function scanViews() {
    const projectRoot = process.cwd();
    const addonBasePath = join(projectRoot, 'node_modules', '@befly-addon');

    /** @type {Array<{ src: string, path: string, exclude: string[] }>} */
    const routesFolders = [];

    // 1. 项目自身 views
    const projectViewsPath = join(projectRoot, 'src', 'views');
    if (existsSync(projectViewsPath)) {
        routesFolders.push({
            src: projectViewsPath,
            path: '',
            exclude: ['**/components/**']
        });
    }

    // 2. 扫描 @befly-addon/*/views
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

            const viewsPath = join(addonPath, 'views');
            if (existsSync(viewsPath)) {
                routesFolders.push({
                    src: viewsPath,
                    path: `addon/${addonName}/`,
                    exclude: ['**/components/**']
                });
            }
        }
    } catch {
        // 扫描失败保持静默，避免影响 Vite 启动
    }

    return routesFolders;
}
