import { buildLayoutConfigs } from "./util.js";

/**
 * 将 auto-routes 的 routes 按 `_数字` 规则套用布局组件，并输出 Vue Router 的 RouteRecordRaw[]。
 *
 * @param {any[]} routes
 * @param {(layoutName: string) => any} resolveLayoutComponent
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
export function Layouts(routes, resolveLayoutComponent) {
    const configs = buildLayoutConfigs(routes);

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
