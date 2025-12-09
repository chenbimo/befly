export default {
    name: '删除系统配置',
    fields: {
        id: '@id'
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否为系统配置
            const config = await befly.db.getDetail({
                table: 'addon_admin_sys_config',
                where: { id: ctx.body.id }
            });

            if (!config) {
                return befly.tool.No('配置不存在');
            }

            if (config.isSystem === 1) {
                return befly.tool.No('系统配置不允许删除');
            }

            await befly.db.delData({
                table: 'addon_admin_sys_config',
                where: { id: ctx.body.id }
            });

            return befly.tool.Yes('操作成功');
        } catch (error) {
            befly.logger.error({ err: error }, '删除系统配置失败');
            return befly.tool.No('操作失败');
        }
    }
};
