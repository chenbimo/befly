import { $Config } from "@/config";
import { $Storage } from "@/plugins/storage";
import { applyTokenAuthGuard } from "befly-vite/utils/routerGuard";
import { buildLayoutRoutes } from "befly-vite/utils/routerLayouts";
import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

// 应用自定义布局系统
const layoutRoutes = buildLayoutRoutes(routes, (layoutName) => {
    return layoutName === "default" ? () => import("@/layouts/default.vue") : () => import(`@/layouts/${layoutName}.vue`);
});

// 添加根路径重定向
const finalRoutes = [
    {
        path: "/",
        redirect: $Config.homePath
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
applyTokenAuthGuard(router, {
    getToken: () => $Storage.local.get("token"),
    loginPath: $Config.loginPath,
    homePath: $Config.homePath
});

// 路由就绪后处理
router.afterEach((_to) => {
    // 可以在这里添加页面访问统计等
    if (import.meta.env.DEV) {
        // 开发环境调试日志请使用更合适的日志方案（此处避免 console 触发 lint 门禁）
    }
});
