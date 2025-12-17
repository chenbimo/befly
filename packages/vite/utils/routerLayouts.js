/**
 * 路由与布局装配工具函数
 */

import { Layouts, applyLayouts } from "./layouts.js";

/**
 * 将 auto-routes 的 routes 按 `_数字` 规则套用布局组件，并输出 Vue Router 的 RouteRecordRaw[]。
 *
 * @param {any[]} routes
 * @param {(layoutName: string) => any} resolveLayoutComponent
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
export function buildLayoutRoutes(routes, resolveLayoutComponent) {
    return applyLayouts(Layouts(routes), resolveLayoutComponent);
}
