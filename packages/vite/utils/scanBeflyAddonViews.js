import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 扫描所有 @befly-addon 包的 views 目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 * 注意：此函数只能在 vite.config.js 中使用（Node.js 环境），不能在浏览器中使用
 * @returns 路由文件夹配置数组
 */
export function scanBeflyAddonViews() {
    // 使用绝对路径：基于项目根目录（process.cwd()）
    const projectRoot = process.cwd();
    const addonBasePath = join(projectRoot, 'node_modules', '@befly-addon');
    const routesFolders = [];

    if (!existsSync(addonBasePath)) {
        return routesFolders;
    }

    try {
        const addonDirs = readdirSync(addonBasePath);

        for (const addonName of addonDirs) {
            const addonPath = join(addonBasePath, addonName);

            // 检查是否为目录（包括符号链接）
            if (!existsSync(addonPath)) continue;

            const viewsPath = join(addonPath, 'views');

            if (existsSync(viewsPath)) {
                routesFolders.push({
                    src: viewsPath,
                    path: `addon/${addonName}/`
                });
            }
        }
    } catch (error) {
        console.error('扫描 @befly-addon 目录失败:', error);
    }

    return routesFolders;
}
