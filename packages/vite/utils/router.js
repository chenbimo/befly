/**
 * 路由相关工具函数（守卫 / 布局装配 / resolver 等）
 */

import { Layouts, applyLayouts } from "./layouts.js";

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

/**
 * 应用一个最小可用的 token 鉴权守卫（业务方提供 token 获取方式与路径）。
 *
 * 约定：当路由 meta.public === true 时认为是公开路由。
 *
 * @param {import('vue-router').Router} router
 * @param {{
 *   getToken: () => any,
 *   loginPath: string,
 *   homePath: string
 * }} options
 */
export function applyTokenAuthGuard(router, options) {
    const normalizedLoginPath = normalizeRoutePath(options.loginPath);
    const normalizedHomePath = normalizeRoutePath(options.homePath);

    router.beforeEach(async (to, _from, next) => {
        const token = options.getToken();
        const toPath = normalizeRoutePath(to.path);

        // 0. 根路径重定向
        if (toPath === "/") {
            return next(token ? normalizedHomePath : normalizedLoginPath);
        }

        // 1. 未登录且访问非公开路由 → 跳转登录
        if (!token && to.meta?.public !== true && toPath !== normalizedLoginPath) {
            return next(normalizedLoginPath);
        }

        // 2. 已登录访问登录页 → 跳转首页
        if (token && toPath === normalizedLoginPath) {
            return next(normalizedHomePath);
        }

        next();
    });
}

/**
 * 将“组件/懒加载函数/Promise”统一转换为 Vue Router 可接受的懒加载 component 函数。
 *
 * - 如果已经是函数（通常是 `() => import(...)`），直接返回。
 * - 否则包一层函数（使其变成 lazy component）。
 *
 * @param {any} value
 * @returns {any}
 */
function toLazyComponent(value) {
    if (typeof value === "function") {
        return value;
    }

    return () => value;
}

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
    return applyLayouts(Layouts(routes), resolveLayoutComponent);
}
