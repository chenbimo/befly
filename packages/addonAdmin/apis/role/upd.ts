import adminRoleTable from '../../tables/role.json';

export default {
    name: '更新角色',
    fields: adminRoleTable,
    handler: async (befly, ctx) => {
        // 检查角色代码是否被其他角色占用
        const existing = await befly.db.getList({
            table: 'addon_admin_role',
            where: {
                code: ctx.body.code,
                id$ne: ctx.body.id
            }
        });

        if (existing.total > 0) {
            return befly.tool.No('角色代码已被其他角色使用');
        }

        await befly.db.updData({
            table: 'addon_admin_role',
            where: { id: ctx.body.id },
            data: {
                name: ctx.body.name,
                code: ctx.body.code,
                description: ctx.body.description,
                menus: ctx.body.menus || [],
                apis: ctx.body.apis || [],
                sort: ctx.body.sort
                // state 字段不在此处更新，需要禁用/启用时单独处理
            }
        });

        // 增量更新角色权限缓存（先删除再重建）
        await befly.cache.cacheRolePermissions(befly, ctx.body.code, ctx.body.apis || []);

        return befly.tool.Yes('操作成功');
    }
};
