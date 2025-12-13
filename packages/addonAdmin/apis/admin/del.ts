export default {
    name: '删除管理员',
    fields: {
        id: '@id'
    },
    required: ['id'],
    handler: async (befly, ctx) => {
        // 检查管理员是否存在
        const adminData = await befly.db.getOne({
            table: 'addon_admin_admin',
            where: { id: ctx.body.id }
        });

        if (!adminData?.id) {
            return befly.tool.No('管理员不存在');
        }

        // 不能删除 dev 角色的管理员
        if (adminData.roleCode === 'dev') {
            return befly.tool.No('不能删除开发管理员');
        }

        // 删除管理员
        await befly.db.delData({
            table: 'addon_admin_admin',
            where: { id: ctx.body.id }
        });

        return befly.tool.Yes('删除成功');
    }
};
