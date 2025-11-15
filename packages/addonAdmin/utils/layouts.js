/**
 * 布局配置接口
 * @typedef {Object} LayoutConfig
 * @property {string} path - 路径
 * @property {string} layoutName - 布局名称
 * @property {import('vue-router').Component} component - 组件
 * @property {LayoutConfig[]} [children] - 子配置
 * @property {Record<string, any>} [meta] - 元信息
 */

/**
 * 自定义布局处理函数
 * 根据文件名后缀判断使用哪个布局
 * @param {import('vue-router').RouteRecordRaw[]} routes - 原始路由配置
 * @param {string} inheritLayout - 继承的布局名称（来自父级目录）
 * @returns {LayoutConfig[]} 处理后的布局配置（不包含实际的布局组件导入）
 */
export function Layouts(routes, inheritLayout = '') {
    const result = [];

    for (const route of routes) {
        const currentPath = route.path || '';

        // 检查当前路径是否有 _数字 格式
        const pathMatch = currentPath.match(/_(\d+)$/);
        const currentLayout = pathMatch ? pathMatch[1] : inheritLayout;

        // 如果有子路由，说明这是中间节点（目录），不包裹布局，只递归处理子路由
        if (route.children && route.children.length > 0) {
            // 清理路径：如果是 xxx_数字 格式，去掉 _数字
            const cleanPath = pathMatch ? currentPath.replace(/_\d+$/, '') : currentPath;

            // 直接递归处理子路由，不添加当前层级到结果
            const childConfigs = Layouts(route.children, currentLayout);

            // 将子路由的路径前缀加上当前路径
            for (const child of childConfigs) {
                result.push({
                    ...child,
                    path: cleanPath ? `${cleanPath}/${child.path}`.replace(/\/+/g, '/') : child.path
                });
            }
            continue;
        }

        // 没有子路由的叶子节点，需要包裹布局
        const lastPart = currentPath;

        // 匹配 _数字 格式（如 index_1, news_2）
        const match = lastPart.match(/_(\d+)$/);
        // 优先使用文件自己的布局，其次使用继承的布局，最后使用 default
        const layoutName = match ? match[1] : currentLayout || 'default';

        // 计算清理后的路径
        let cleanPath;
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
            component: route.component,
            meta: route.meta
        });
    }

    return result;
}
