import { createRouter, createWebHashHistory } from 'vue-router';
import { routes } from 'vue-router/auto-routes';
import { $Storage } from '@/plugins/storage';
import { Layouts } from 'befly-util/layouts';

/**
 * @typedef {import('befly-util').LayoutConfig} LayoutConfig
 */

/**
 * 将布局配置转换为实际的路由配置
 * 在这里执行实际的布局组件导入
 * @param {LayoutConfig[]} configs
 * @returns {import('vue-router').RouteRecordRaw[]}
 */
function applyLayouts(configs) {
    return configs.map((config) => {
        // 根据布局名称加载对应的布局组件
        const layoutComponent = config.layoutName === 'default' ? () => import('@/layouts/default.vue') : () => import(`@/layouts/${config.layoutName}.vue`);

        // 所有配置都是叶子节点（Layouts 函数已经扁平化处理）
        // 直接包裹布局
        return {
            path: config.path,
            component: layoutComponent,
            meta: config.meta,
            children: [
                {
                    path: '',
                    component: config.component
                }
            ]
        };
    });
}

// 应用自定义布局系统
const layoutRoutes = applyLayouts(Layouts(routes));

// 添加根路径重定向
const finalRoutes = [
    {
        path: '/',
        redirect: '/addon/admin'
    },
    ...layoutRoutes
];

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
