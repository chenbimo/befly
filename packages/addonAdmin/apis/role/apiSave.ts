import adminRoleTable from '../../tables/role.json';

export default {
    name: '保存角色接口权限',
    fields: {
        roleCode: adminRoleTable.code,
        apiIds: adminRoleTable.apis
    },
    handler: async (befly, ctx) => {
        // 查询角色是否存在
        const role = await befly.db.getOne({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode }
        });

        if (!role) {
            return befly.tool.No('角色不存在');
        }

        // 将数组转为逗号分隔的字符串存储
        const apiIdsStr = Array.isArray(ctx.body.apiIds) ? ctx.body.apiIds.join(',') : '';

        // 更新角色的接口权限
        await befly.db.updData({
            table: 'addon_admin_role',
            where: { code: ctx.body.roleCode },
            data: {
                apis: apiIdsStr
            }
        });

        // 增量更新 Redis 缓存
        await befly.cache.cacheRolePermissions(befly, role.code, apiIdsStr);

        return befly.tool.Yes('操作成功');
    }
};
