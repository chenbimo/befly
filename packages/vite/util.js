/**
 * 内部工具函数集合（不对外导出）
 *
 * 说明：该文件仅供 befly-vite 包内部模块使用。
 */

/**
 * @typedef {Object} RouteConfig
 * @property {string=} path
 * @property {any=} component
 * @property {RouteConfig[]=} children
 * @property {Record<string, any>=} meta
 */

/**
 * @typedef {Object} LayoutConfig
 * @property {string} path
 * @property {string} layoutName
 * @property {any} component
 * @property {Record<string, any>=} meta
 */

/**
 * 根据文件名后缀 _数字 判断使用哪个布局，输出扁平布局配置。
 *
 * @param {RouteConfig[]} routes
 * @param {string=} inheritLayout
 * @returns {LayoutConfig[]}
 */
export function layouts(routes, inheritLayout = "") {
    /** @type {LayoutConfig[]} */
    const result = [];

    for (const route of routes) {
        const currentPath = route.path || "";

        const pathMatch = currentPath.match(/_(\d+)$/);
        const currentLayout = pathMatch ? pathMatch[1] : inheritLayout;

        // 中间节点：递归处理子路由，不包裹布局
        if (route.children && route.children.length > 0) {
            const cleanPath = pathMatch ? currentPath.replace(/_\d+$/, "") : currentPath;
            const childConfigs = layouts(route.children, currentLayout);

            for (const child of childConfigs) {
                const mergedPath = cleanPath ? `${cleanPath}/${child.path}`.replace(/\/+/, "/") : child.path;
                result.push({
                    path: mergedPath,
                    layoutName: child.layoutName,
                    component: child.component,
                    meta: child.meta
                });
            }
            continue;
        }

        // 叶子节点：包裹布局
        const lastPart = currentPath;
        const match = lastPart.match(/_(\d+)$/);
        const layoutName = match ? match[1] : currentLayout || "default";

        let cleanPath = "";
        if (lastPart === "index" || (lastPart.startsWith("index_") && match)) {
            cleanPath = "";
        } else if (match) {
            cleanPath = lastPart.replace(/_\d+$/, "");
        } else {
            cleanPath = lastPart;
        }

        result.push({
            path: cleanPath,
            layoutName: layoutName,
            component: route.component,
            meta: route.meta
        });
    }

    return result;
}

/**
 * 将 layouts 输出的扁平配置转换为 Vue Router 的 RouteRecordRaw。
 *
 * @param {LayoutConfig[]} configs
 * @param {(layoutName: string) => any} resolveLayoutComponent
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
export function applyLayouts(configs, resolveLayoutComponent) {
    return configs.map((config) => {
        const layoutComponent = resolveLayoutComponent(config.layoutName);

        return {
            path: config.path,
            component: layoutComponent,
            meta: config.meta,
            children: [
                {
                    path: "",
                    component: config.component
                }
            ]
        };
    });
}

/**
 * 将“组件/懒加载函数/Promise”统一转换为 Vue Router 可接受的懒加载 component 函数。
 *
 * @param {any} value
 * @returns {any}
 */
export function toLazyComponent(value) {
    if (typeof value === "function") {
        return value;
    }

    return () => value;
}

/**
 * 规范化路由 path：去尾随 "/"（根路径 "/" 例外）。
 *
 * @param {any} path
 * @returns {any}
 */
export function normalizeRoutePath(path) {
    if (typeof path !== "string") {
        return path;
    }

    const normalized = path.replace(/\/+$/, "");
    return normalized.length === 0 ? "/" : normalized;
}
