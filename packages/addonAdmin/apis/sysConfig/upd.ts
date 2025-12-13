import sysConfigTable from '../../tables/sysConfig.json';

export default {
    name: '更新系统配置',
    fields: {
        id: '@id',
        ...sysConfigTable
    },
    handler: async (befly, ctx) => {
        try {
            // 检查是否为系统配置
            const config = await befly.db.getDetail({
                table: 'addon_admin_sys_config',
                where: { id: ctx.body.id }
            });

            if (!config?.id) {
                return befly.tool.No('配置不存在');
            }

            // 系统配置只能修改 value
            if (config.isSystem === 1) {
                await befly.db.updData({
                    table: 'addon_admin_sys_config',
                    data: {
                        value: ctx.body.value
                    },
                    where: { id: ctx.body.id }
                });
            } else {
                await befly.db.updData({
                    table: 'addon_admin_sys_config',
                    data: {
                        name: ctx.body.name,
                        code: ctx.body.code,
                        value: ctx.body.value,
                        valueType: ctx.body.valueType,
                        group: ctx.body.group,
                        sort: ctx.body.sort,
                        description: ctx.body.description,
                        state: ctx.body.state
                    },
                    where: { id: ctx.body.id }
                });
            }

            return befly.tool.Yes('操作成功');
        } catch (error) {
            befly.logger.error({ err: error }, '更新系统配置失败');
            return befly.tool.No('操作失败');
        }
    }
};
