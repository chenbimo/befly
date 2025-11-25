/**
 * 刷新全部缓存接口
 *
 * 功能：
 * 1. 刷新接口缓存（apis:all）
 * 2. 刷新菜单缓存（menus:all）
 * 3. 刷新角色权限缓存（role:{code}）
 *
 * 使用场景：
 * - 执行数据库同步后
 * - 手动修改配置需要立即生效
 * - 缓存出现异常需要重建
 */

export default {
    name: '刷新全部缓存',
    handler: async (befly, ctx) => {
        try {
            const results: Record<string, any> = {
                apis: { success: false, count: 0 },
                menus: { success: false, count: 0 },
                roles: { success: false, count: 0 }
            };

            // 1. 刷新接口缓存
            try {
                const apis = await befly.db.getAll({
                    table: 'addon_admin_api',
                    fields: ['id', 'name', 'path', 'method', 'description', 'addonName', 'addonTitle'],
                    orderBy: ['addonName#ASC', 'path#ASC']
                });

                await befly.redis.setObject('apis:all', apis);
                results.apis = { success: true, count: apis.length };
            } catch (error: any) {
                befly.logger.error('刷新接口缓存失败:', error);
                results.apis = { success: false, error: error.message };
            }

            // 2. 刷新菜单缓存
            try {
                const menus = await befly.db.getAll({
                    table: 'addon_admin_menu',
                    fields: ['id', 'pid', 'name', 'path', 'icon', 'type', 'sort'],
                    orderBy: ['sort#ASC', 'id#ASC']
                });

                await befly.redis.setObject('menus:all', menus);

                const parentCount = menus.filter((m: any) => m.pid === 0).length;
                const childCount = menus.filter((m: any) => m.pid !== 0).length;

                results.menus = {
                    success: true,
                    count: menus.length,
                    parentCount: parentCount,
                    childCount: childCount
                };
            } catch (error: any) {
                befly.logger.error('刷新菜单缓存失败:', error);
                results.menus = { success: false, error: error.message };
            }

            // 3. 刷新角色权限缓存
            try {
                const roles = await befly.db.getAll({
                    table: 'addon_admin_role',
                    fields: ['id', 'name', 'code', 'apis', 'menus'],
                    orderBy: ['id#ASC']
                });

                // 为每个角色单独缓存
                let cachedCount = 0;
                for (const role of roles) {
                    await befly.redis.setObject(`role:${role.code}`, role);
                    cachedCount++;
                }

                results.roles = { success: true, count: cachedCount };
            } catch (error: any) {
                befly.logger.error('刷新角色缓存失败:', error);
                results.roles = { success: false, error: error.message };
            }

            // 检查是否全部成功
            const allSuccess = results.apis.success && results.menus.success && results.roles.success;

            if (allSuccess) {
                return befly.tool.Yes('全部缓存刷新成功', results);
            } else {
                return befly.tool.No('部分缓存刷新失败', results);
            }
        } catch (error: any) {
            befly.logger.error('刷新全部缓存失败:', error);
            return befly.tool.No('刷新全部缓存失败', { error: error.message });
        }
    }
};
