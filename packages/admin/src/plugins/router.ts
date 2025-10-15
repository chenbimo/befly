import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';
import { usePermissionStore } from '@/stores/permission';

/**
 * 创建并导出路由实例
 * 可直接在 main.ts 中使用 app.use(router)
 */
export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: autoRoutes
});

// 公开路由列表（无需登录和权限）
const publicRoutes = ['/login', '/register', '/404', '/403'];

// 路由守卫 - 权限验证
router.beforeEach(async (to, from, next) => {
    // 设置页面标题
    const titlePrefix = 'Befly Admin';
    if (to.meta?.title) {
        document.title = `${titlePrefix} - ${to.meta.title}`;
    } else {
        document.title = titlePrefix;
    }

    const token = localStorage.getItem('token');
    const isPublicRoute = publicRoutes.includes(to.path);
    const permissionStore = usePermissionStore();

    // 1. 未登录且访问非公开路由 → 跳转登录
    if (!token && !isPublicRoute) {
        return next('/login');
    }

    // 2. 已登录但未加载菜单权限 → 加载权限
    if (token && !permissionStore.menusLoaded && !isPublicRoute) {
        const success = await permissionStore.fetchUserMenus();
        if (!success) {
            // 加载权限失败，清除 token 并跳转登录
            localStorage.removeItem('token');
            MessagePlugin.error('获取权限失败，请重新登录');
            return next('/login');
        }
    }

    // 3. 已登录且已加载权限 → 检查路由权限
    if (token && !isPublicRoute) {
        const hasPermission = permissionStore.hasRoutePermission(to.path);
        if (!hasPermission) {
            MessagePlugin.warning('您没有访问该页面的权限');
            return next('/403');
        }
    }

    // 4. 已登录访问登录页 → 跳转首页
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
