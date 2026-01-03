import { $Storage } from "@/plugins/storage";
import { Layouts } from "befly-vite";
import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

// 应用自定义布局系统（同时可选注入根路径重定向）
const finalRoutes = Layouts(routes, $Config.homePath, (layoutName) => {
    if (layoutName === "default") {
        return () => import("@/layouts/default.vue");
    }

    return () => import(`@/layouts/${layoutName}.vue`);
});

/**
 * 创建并导出路由实例
 * 可直接在 main.js 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: finalRoutes
});

// 路由守卫 - 基础鉴权（最小实现：public 放行；未登录跳登录；已登录访问登录页跳首页）
router.beforeEach((to, _from, next) => {
    const token = $Storage.local.get("token");
    const toPath = to.path;

    // 根路径：按是否登录分流（兜底，避免 / 永远重定向到首页）
    if (toPath === "/") {
        return next(token ? $Config.homePath : $Config.loginPath);
    }

    // 公开路由放行
    if (to.meta?.public === true) {
        return next();
    }

    // 未登录访问非公开路由 → 登录页
    if (!token && toPath !== $Config.loginPath) {
        return next($Config.loginPath);
    }

    // 已登录访问登录页 → 首页
    if (token && toPath === $Config.loginPath) {
        return next($Config.homePath);
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
