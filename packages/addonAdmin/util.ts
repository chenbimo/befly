import type { RouteRecordRaw, Component } from 'vue-router';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 布局配置接口
 */
export interface LayoutConfig {
    path: string;
    layoutName: string;
    component: Component;
    children?: LayoutConfig[];
    meta?: Record<string, any>;
}

/**
 * 自定义布局处理函数
 * 根据文件名后缀判断使用哪个布局
 * @param routes - 原始路由配置
 * @param inheritLayout - 继承的布局名称（来自父级目录）
 * @returns 处理后的布局配置（不包含实际的布局组件导入）
 */
export function Layouts(routes: RouteRecordRaw[], inheritLayout = ''): LayoutConfig[] {
    const result: LayoutConfig[] = [];

    for (const route of routes) {
        const currentPath = route.path || '';

        // 检查当前路径是否有 _数字 格式
        const pathMatch = currentPath.match(/_(\d+)$/);
        const currentLayout = pathMatch ? pathMatch[1] : inheritLayout;

        // 如果有子路由，递归处理（传递当前布局给子级）
        if (route.children && route.children.length > 0) {
            // 清理路径：如果是 xxx_数字 格式，去掉 _数字
            const cleanPath = pathMatch ? currentPath.replace(/_\d+$/, '') : currentPath;

            result.push({
                path: cleanPath,
                layoutName: currentLayout || 'default',
                component: route.component!,
                children: Layouts(route.children, currentLayout),
                meta: route.meta
            });
            continue;
        }

        // 没有子路由的叶子节点，需要包裹布局
        const lastPart = currentPath;

        // 匹配 _数字 格式（如 index_1, news_2）
        const match = lastPart.match(/_(\d+)$/);
        // 优先使用文件自己的布局，其次使用继承的布局，最后使用 default
        const layoutName = match ? match[1] : currentLayout || 'default';

        // 计算清理后的路径
        let cleanPath: string;
        if (lastPart === 'index' || (lastPart.startsWith('index_') && match)) {
            // index 或 index_数字 → 改为空路径（由父级路径表示）
            cleanPath = '';
        } else if (match) {
            // xxx_数字 → 去掉 _数字 后缀
            cleanPath = lastPart.replace(/_\d+$/, '');
        } else {
            // 其他 → 保持原样
            cleanPath = lastPart;
        }

        // 返回布局配置（不执行实际导入）
        result.push({
            path: cleanPath,
            layoutName: layoutName,
            component: route.component!,
            meta: route.meta
        });
    }

    return result;
}

/**
 * 扫描所有 @befly-addon 包的 views 目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 * @returns 路由文件夹配置数组
 */
export function scanBeflyAddonViews() {
    // 使用绝对路径：基于项目根目录（process.cwd()）
    const projectRoot = process.cwd();
    const addonBasePath = join(projectRoot, 'node_modules', '@befly-addon');
    const routesFolders: Array<{ src: string; path: string }> = [];

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
