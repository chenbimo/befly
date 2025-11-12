import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';
import { $Storage } from '@/plugins/storage';

// 布局组件映射
const layouts: Record<string, any> = {
    default: () => import('@/layouts/default.vue'),
    1: () => import('@/layouts/1.vue'),
    2: () => import('@/layouts/2.vue')
    // 可以继续添加其他数字布局
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

        // 提取路由路径中的布局标识
        const pathParts = route.path.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1] || '';

        // 匹配 _数字 格式（如 index_1, news_2）
        const match = lastPart.match(/_(\d+)$/);
        const layoutName = match ? match[1] : 'default';

        // 处理路径：
        // 1. index_1 → 去掉 /index_1，保留父路径
        // 2. news_2 → 去掉 _2，保留 /news
        let cleanPath = route.path;
        if (match) {
            if (lastPart.startsWith('index_')) {
                // index_1.vue → 去掉整个 /index_1
                cleanPath = route.path.replace(/\/index_\d+$/, '');
            } else {
                // news_2.vue → 去掉 _2，保留 /news
                cleanPath = route.path.replace(/_\d+$/, '');
            }
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
