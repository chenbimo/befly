/**
 * 权限管理 Store
 * 功能：
 * 1. 存储用户菜单权限
 * 2. 存储用户路由权限
 * 3. 提供权限检查方法
 */
export const usePermissionStore = defineStore('permission', () => {
    // 用户菜单树
    const userMenus = $ref<any[]>([]);

    // 用户可访问的路由路径集合
    const userRoutePaths = $ref<Set<string>>(new Set());

    // 是否已加载菜单
    let menusLoaded = $ref(false);

    /**
     * 获取用户菜单权限
     */
    async function fetchUserMenus() {
        try {
            const { data } = await $Http.get('/admin/adminMenus');

            if (data && Array.isArray(data)) {
                userMenus.splice(0, userMenus.length, ...data);

                // 提取所有路由路径
                const paths = new Set<string>();
                const extractPaths = (menus: any[]) => {
                    menus.forEach((menu) => {
                        if (menu.path) {
                            paths.add(menu.path);
                        }
                        if (menu.children && menu.children.length > 0) {
                            extractPaths(menu.children);
                        }
                    });
                };
                extractPaths(data);

                userRoutePaths.clear();
                paths.forEach((path) => userRoutePaths.add(path));

                menusLoaded = true;

                return true;
            }
            return false;
        } catch (error) {
            console.error('获取用户菜单失败:', error);
            return false;
        }
    }

    /**
     * 检查用户是否有访问指定路径的权限
     * @param path 路由路径
     */
    function hasRoutePermission(path: string): boolean {
        // 公开路由，无需权限
        const publicRoutes = ['/', '/login', '/register', '/404', '/403'];
        if (publicRoutes.includes(path)) {
            return true;
        }

        return userRoutePaths.has(path);
    }

    /**
     * 清空权限数据（退出登录时调用）
     */
    function clearPermissions() {
        userMenus.splice(0, userMenus.length);
        userRoutePaths.clear();
        menusLoaded = false;
    }

    return {
        // 状态
        userMenus: $$(userMenus),
        userRoutePaths: $$(userRoutePaths),
        menusLoaded: $$(menusLoaded),

        // 方法
        fetchUserMenus,
        hasRoutePermission,
        clearPermissions
    };
});
