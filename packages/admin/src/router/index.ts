import { createRouter, createWebHashHistory } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';
import { $Storage } from '@/plugins/storage';

// 打印自动生成的路由信息
console.log('=== 自动生成的路由列表 ===');
console.log(`路由总数: ${routes.length}`);
routes.forEach((route, index) => {
    console.log(`${index + 1}. ${route.path}`, route.name ? `(name: ${String(route.name)})` : '');
    if (route.children && route.children.length > 0) {
        route.children.forEach((child, childIndex) => {
            console.log(`   ${index + 1}.${childIndex + 1} ${child.path}`, child.name ? `(name: ${String(child.name)})` : '');
        });
    }
});
console.log('========================');

/**
 * 创建并导出路由实例
 * 可直接在 main.ts 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: routes
});

// HMR 支持
if (import.meta.hot) {
    handleHotUpdate(router);
}

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

    // 判断是否为公开路由：meta.public 为 true 表示公开路由
    const isPublicRoute = to.meta?.public === true;

    // 1. 未登录且访问非公开路由 → 跳转登录
    if (!token && !isPublicRoute) {
        return next('/internal/login');
    }

    // 2. 已登录访问登录页 → 跳转首页
    if (token && to.path === '/internal/login') {
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
