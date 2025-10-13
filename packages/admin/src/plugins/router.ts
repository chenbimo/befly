import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';

/**
 * 创建并导出路由实例
 * 可直接在 main.ts 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: autoRoutes
});

// 路由守卫 - 使用现代语法
router.beforeEach((to, from, next) => {
    // 设置页面标题
    const titlePrefix = 'Befly Admin';
    if (to.meta?.title) {
        document.title = `${titlePrefix} - ${to.meta.title}`;
    } else {
        document.title = titlePrefix;
    }

    // 登录验证 - 更安全的检查
    const token = localStorage.getItem('token');
    const isPublicRoute = to.meta?.public === true;

    if (!isPublicRoute && !token) {
        next('/login');
    } else {
        next();
    }
});

// 路由就绪后处理
router.afterEach((to) => {
    // 可以在这里添加页面访问统计等
    console.log(`[Router] 导航到: ${to.path}`);
});
