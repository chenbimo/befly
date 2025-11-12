import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { routes, handleHotUpdate } from 'vue-router/auto-routes';
import { $Storage } from '@/plugins/storage';

/**
 * 自定义布局处理函数
 * 根据文件名后缀判断使用哪个布局
 * @param routes - 原始路由配置
 * @param inheritLayout - 继承的布局名称（来自父级目录）
 * @returns 处理后的路由配置
 */
function setupCustomLayouts(routes: RouteRecordRaw[], inheritLayout = ''): RouteRecordRaw[] {
    const result: RouteRecordRaw[] = [];

    for (const route of routes) {
        const currentPath = route.path || '';

        // 检查当前路径是否有 _数字 格式
        const pathMatch = currentPath.match(/_(\d+)$/);
        const currentLayout = pathMatch ? pathMatch[1] : inheritLayout;

        // 如果有子路由，递归处理（传递当前布局给子级）
        if (route.children && route.children.length > 0) {
            // 清理路径：如果是 xxx_数字 格式，去掉 _数字
            const cleanPath = pathMatch ? currentPath.replace(/_\d+$/, '') : currentPath;

            result.push({
                ...route,
                path: cleanPath,
                children: setupCustomLayouts(route.children, currentLayout)
            });
            continue;
        }

        // 没有子路由的叶子节点，需要包裹布局
        const lastPart = currentPath;

        // 匹配 _数字 格式（如 index_1, news_2）
        const match = lastPart.match(/_(\d+)$/);
        // 优先使用文件自己的布局，其次使用继承的布局，最后使用 default
        const layoutName = match ? match[1] : currentLayout || 'default';

        // 计算清理后的路径
        let cleanPath: string;
        if (lastPart === 'index' || (lastPart.startsWith('index_') && match)) {
            // index 或 index_数字 → 改为空路径（由父级路径表示）
            cleanPath = '';
        } else if (match) {
            // xxx_数字 → 去掉 _数字 后缀
            cleanPath = lastPart.replace(/_\d+$/, '');
        } else {
            // 其他 → 保持原样
            cleanPath = lastPart;
        }

        // 根据布局名称加载对应组件
        const layoutComponent = layoutName === 'default' ? () => import('@/layouts/default.vue') : () => import(`@/layouts/${layoutName}.vue`);

        // 包裹布局
        result.push({
            path: cleanPath,
            component: layoutComponent,
            children: [
                {
                    ...route,
                    path: ''
                }
            ]
        });
    }

    return result;
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
