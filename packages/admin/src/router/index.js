import { $Storage } from "@/plugins/storage";
import { Layouts, applyLayouts } from "befly-vite/utils/layouts";
import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

const loginPath = "/addon/admin/login";
const homePath = "/dashboard";

const normalizePath = (path) => {
    if (typeof path !== "string") {
        return path;
    }

    const normalized = path.replace(/\/+$/, "");
    return normalized.length === 0 ? "/" : normalized;
};

// 应用自定义布局系统
const layoutRoutes = applyLayouts(Layouts(routes), (layoutName) => {
    return layoutName === "default" ? () => import("@/layouts/default.vue") : () => import(`@/layouts/${layoutName}.vue`);
});

// 添加根路径重定向
const finalRoutes = [
    {
        path: "/",
        redirect: homePath
    }
].concat(layoutRoutes);

/**
 * 创建并导出路由实例
 * 可直接在 main.js 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: finalRoutes
});

// 路由守卫 - 基础验证
router.beforeEach(async (to, from, next) => {
    const token = $Storage.local.get("token");
    const toPath = normalizePath(to.path);

    // 0. 根路径重定向
    if (toPath === "/") {
        return next(token ? homePath : loginPath);
    }

    // 1. 未登录且访问非公开路由 → 跳转登录
    if (!token && to.meta?.public !== true && toPath !== normalizePath(loginPath)) {
        return next(loginPath);
    }

    // 2. 已登录访问登录页 → 跳转首页
    if (token && toPath === normalizePath(loginPath)) {
        return next(homePath);
    }

    next();
});

// 路由就绪后处理
router.afterEach((_to) => {
    // 可以在这里添加页面访问统计等
    if (import.meta.env.DEV) {
        // 开发环境调试日志请使用更合适的日志方案（此处避免 console 触发 lint 门禁）
    }
});
