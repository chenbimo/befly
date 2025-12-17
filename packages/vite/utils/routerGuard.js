/**
 * 路由相关工具函数（守卫/路径规范化等）
 */

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
