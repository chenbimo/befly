import { createRouter, createWebHashHistory } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';
import { setupLayouts } from 'virtual:generated-layouts';
import { $Storage } from '@/plugins/storage';

// 应用布局系统
const layoutRoutes = setupLayouts(routes);

/**
 * 创建并导出路由实例
 * 可直接在 main.ts 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: layoutRoutes
});

// HMR 支持
if (import.meta.hot) {
    handleHotUpdate(router);
}

// 路由守卫 - 基础验证
router.beforeEach(async (to, from, next) => {
    const token = $Storage.local.get('token');

    // 1. 未登录且访问非公开路由 → 跳转登录
    if (!token && to.meta?.public !== true) {
        return next('/addon/admin/login');
    }

    // 2. 已登录访问登录页 → 跳转首页
    if (token && to.path === '/addon/admin/login') {
        return next('/addon/admin');
    }

    next();
});

// 路由就绪后处理
router.afterEach((to) => {
    // 可以在这里添加页面访问统计等
    if (import.meta.env.DEV) {
        console.log(`[Router] 导航到: ${to.path}`);
    }
});
