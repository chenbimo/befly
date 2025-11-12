import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';
import { $Storage } from '@/plugins/storage';

// 布局组件映射
const layouts: Record<string, any> = {
    default: () => import('@/layouts/default.vue'),
    n: () => import('@/layouts/n.vue')
    // 可以继续添加其他布局: '1': () => import('@/layouts/1.vue')
};

/**
 * 自定义布局处理函数
 * 根据文件名后缀判断使用哪个布局
 * @param routes - 原始路由配置
 * @returns 处理后的路由配置
 */
function setupCustomLayouts(routes: RouteRecordRaw[]): RouteRecordRaw[] {
    return routes.map((route) => {
        // 如果有子路由，递归处理
        if (route.children && route.children.length > 0) {
            return {
                ...route,
                children: setupCustomLayouts(route.children)
            };
        }

        // 提取路由路径中的布局标识（如 /addon/admin/login/index_n 中的 'n'）
        const pathParts = route.path.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || '';
        const match = lastPart.match(/_([a-z0-9]+)$/i);
        const layoutName = match ? match[1] : 'default';

        // 去掉路径中的布局后缀（如 /addon/admin/login/index_n → /addon/admin/login）
        let cleanPath = route.path;
        if (match) {
            cleanPath = route.path.replace(/_[a-z0-9]+$/i, '');
        }

        // 如果布局不存在，使用 default
        const layoutComponent = layouts[layoutName] || layouts.default;

        // 为路由添加布局包裹
        return {
            path: cleanPath,
            component: layoutComponent,
            children: [
                {
                    path: '',
                    ...route,
                    path: ''
                }
            ]
        };
    });
}

// 应用自定义布局系统
const layoutRoutes = setupCustomLayouts(routes);

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

    // 0. 根路径重定向
    if (to.path === '/') {
        return next(token ? '/addon/admin' : '/addon/admin/login');
    }

    // 1. 未登录且访问非公开路由 → 跳转登录
    if (!token && to.meta?.public !== true && to.path !== '/addon/admin/login') {
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
