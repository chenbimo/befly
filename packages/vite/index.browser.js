import { applyLayouts, layouts, toLazyComponent } from "./util.js";

/**
 * 创建布局组件解析器（resolver）。
 *
 * @param {{
 *   resolveDefaultLayout: () => any,
 *   resolveNamedLayout: (layoutName: string) => any,
 *   defaultLayoutName?: string
 * }} options
 * @returns {(layoutName: string) => any}
 */
export function createLayoutComponentResolver(options) {
    const defaultLayoutName = options.defaultLayoutName || "default";

    return (layoutName) => {
        if (layoutName === defaultLayoutName) {
            return toLazyComponent(options.resolveDefaultLayout());
        }

        return toLazyComponent(options.resolveNamedLayout(layoutName));
    };
}

/**
 * 将 auto-routes 的 routes 按 `_数字` 规则套用布局组件，并输出 Vue Router 的 RouteRecordRaw[]。
 *
 * @param {any[]} routes
 * @param {(layoutName: string) => any} resolveLayoutComponent
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
export function buildLayoutRoutes(routes, resolveLayoutComponent) {
    return applyLayouts(layouts(routes), resolveLayoutComponent);
}
