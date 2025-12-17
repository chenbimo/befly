/**
 * 自定义布局处理函数
 * 根据文件名后缀 _数字 判断使用哪个布局
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
 * @param {RouteConfig[]} routes
 * @param {string=} inheritLayout
 * @returns {LayoutConfig[]}
 */
export function Layouts(routes, inheritLayout = "") {
    /** @type {LayoutConfig[]} */
    const result = [];

    for (const route of routes) {
        const currentPath = route.path || "";

        const pathMatch = currentPath.match(/_(\d+)$/);
        const currentLayout = pathMatch ? pathMatch[1] : inheritLayout;

        // 中间节点：递归处理子路由，不包裹布局
        if (route.children && route.children.length > 0) {
            const cleanPath = pathMatch ? currentPath.replace(/_\d+$/, "") : currentPath;
            const childConfigs = Layouts(route.children, currentLayout);

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
