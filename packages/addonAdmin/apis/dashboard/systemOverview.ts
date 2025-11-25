export default {
    name: '获取系统概览数据',
    handler: async (befly, ctx) => {
        // 权限统计
        const menuCount = await befly.db.getCount({
            table: 'addon_admin_menu',
            where: { state: 1 }
        });

        const roleCount = await befly.db.getCount({
            table: 'addon_admin_role',
            where: { state: 1 }
        });

        const apiCount = await befly.db.getCount({
            table: 'addon_admin_api',
            where: { state: 1 }
        });

        return befly.tool.Yes('获取成功', {
            menuCount,
            roleCount,
            apiCount
        });
    }
};
