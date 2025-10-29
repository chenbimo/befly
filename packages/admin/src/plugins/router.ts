import { createRouter, createWebHashHistory } from 'vue-router';
import autoRoutes from 'virtual:befly-auto-routes';
import { $Storage } from './storage';

/**
 * 创建并导出路由实例
 * 可直接在 main.ts 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: autoRoutes
});

// 路由守卫 - 基础验证
router.beforeEach(async (to, from, next) => {
    // 设置页面标题
    const titlePrefix = 'Befly Admin';
    if (to.meta?.title) {
        document.title = `${titlePrefix} - ${to.meta.title}`;
    } else {
        document.title = titlePrefix;
    }

    const token = $Storage.local.get('token');

    // 判断是否为公开路由：使用 layout0 的需要登录，其他 layout 为公开路由
    const isProtectedRoute = to.matched.some((record) => record.name === 'layout0');

    // 1. 未登录且访问受保护路由 → 跳转登录
    if (!token && isProtectedRoute) {
        return next('/login');
    }

    // 2. 已登录访问登录页 → 跳转首页
    if (token && to.path === '/login') {
        return next('/');
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
